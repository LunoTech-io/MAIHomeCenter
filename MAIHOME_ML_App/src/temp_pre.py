import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import os
import pytz

class DigitalTwinModel(nn.Module):
    def __init__(self, lookback_steps=144, forecast_steps=18):
        super(DigitalTwinModel, self).__init__()
        self.lookback_steps = lookback_steps
        self.forecast_steps = forecast_steps # 18 steps = 3 hours
        self.tz = pytz.timezone('Europe/Amsterdam')
        
        self.input_dim = None
        self.target_rooms = [] 
        self.net = None

    def prepare_clean_df(self, df_merged):
        df = df_merged.copy()
        if 'Timestamp' in df.columns:
            df['Timestamp'] = pd.to_datetime(df['Timestamp'], utc=True)
            df.set_index('Timestamp', inplace=True)
        df = df.tz_convert(self.tz)

        # 1. Filter out all watermeter-related columns entirely
        df = df[[c for c in df.columns if 'watermeter' not in c.lower()]]

        # 2. Identify Target Rooms (Living spaces only)
        # Excludes columns ending in '.set' or containing 'watermeter'
        self.target_rooms = [c for c in df.columns if c.lower().endswith('temperature')]
        
        # 3. Identify All Features (PIR, Setpoints, Temperatures)
        keywords = ['temperature', 'set', 'pir']
        feature_cols = [c for c in df.columns if any(k in c.lower() for k in keywords)]
        df = df[feature_cols]

        # 4. Resampling Logic
        df_resampled = df.resample('10min').agg({
            c: ('max' if 'pir' in c.lower() else 'mean') for c in df.columns
        })
        df_resampled = df_resampled.interpolate(method='linear').ffill().bfill()

        # 5. Time Engineering (Cyclical Encoding)
        df_resampled['hour_sin'] = np.sin(2 * np.pi * df_resampled.index.hour / 24)
        df_resampled['hour_cos'] = np.cos(2 * np.pi * df_resampled.index.hour / 24)
        df_resampled['day_sin'] = np.sin(2 * np.pi * df_resampled.index.dayofweek / 7)
        df_resampled['day_cos'] = np.cos(2 * np.pi * df_resampled.index.dayofweek / 7)
        
        return df_resampled

    def dataframe_to_tensor(self, df_processed):
        df = df_processed.copy()
        
        # Normalization: $T_{norm} = \frac{T_{actual} - 10}{35}$
        temp_related = [c for c in df.columns if 'temperature' in c.lower()]
        for col in temp_related:
            df[col] = (df[col] - 10) / 35
            
        pir_cols = [c for c in df.columns if 'pir' in c.lower()]
        for col in pir_cols:
            df[col] = df[col].clip(0, 1)

        # Shift Cyclical Features to [0, 1]
        time_cols = ['hour_sin', 'hour_cos', 'day_sin', 'day_cos']
        for col in time_cols:
            df[col] = (df[col] + 1) / 2

        df = df.clip(0, 1)
        
        if len(df) > self.lookback_steps:
            df = df.iloc[-self.lookback_steps:]
            
        self.input_dim = df.shape[1]
        return torch.tensor(df.values, dtype=torch.float32)

    def init_network(self, model_path=None):
        num_targets = len(self.target_rooms)
        output_dim = num_targets * self.forecast_steps
        

        self.hidden_size = 128
        self.num_layers = 2
        
        self.lstm = nn.LSTM(
            input_size=self.input_dim, 
            hidden_size=self.hidden_size, 
            num_layers=self.num_layers, 
            batch_first=True,
            dropout=0.2
        )
        
        self.fc = nn.Sequential(
            nn.Linear(self.hidden_size, 128),
            nn.ReLU(),
            nn.Linear(128, output_dim)
        )

        if model_path and os.path.exists(model_path):
            self.load_state_dict(torch.load(model_path, map_location='cpu'))
            self.eval()
            print(f"✅ LSTM Weights loaded for {num_targets} rooms.")
        else:
            print(f"⚠️ Random LSTM weights initialized.")

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        last_time_step = lstm_out[:, -1, :] 
        return self.fc(last_time_step)

    # 注意：这里多加了一个参数 df_processed，为了安全获取当前真实温度
    def predict_future(self, input_tensor, df_processed):
        if input_tensor.dim() == 2:
            x = input_tensor.unsqueeze(0)
        else:
            x = input_tensor

        with torch.no_grad():
            raw_out = self.forward(x) 
            # 现在 room_forecasts 里存的是归一化的变化量 (ΔT / 35)
            room_forecasts = raw_out.view(len(self.target_rooms), self.forecast_steps)
        
        result_dict = {
            "meta": {
                "type": "Multi-Room ΔT Prediction (Residual Learning)",
                "horizon": "3 Hours",
                "resolution": "10 min"
            },
            "rooms": {}
        }

        for i, room_name in enumerate(self.target_rooms):
            # 1. 拿到当前房间在历史窗口中的最后一个真实温度 (未归一化的绝对度数)
            current_actual_temp = df_processed[room_name].iloc[-1]
            
            # 2. 拿到模型预测的归一化偏移量
            deltas_norm = room_forecasts[i].tolist()
            
            # 3. 核心计算：实际温度 = 当前温度 + (归一化偏移量 * 35)
            # 因为 ΔT_norm = ΔT / 35，所以 ΔT = ΔT_norm * 35
            actual_temps = [
                round(current_actual_temp + (d * 35), 2) 
                for d in deltas_norm
            ]
            
            result_dict["rooms"][room_name] = [
                {"offset_min": (j+1)*10, "temp": t} 
                for j, t in enumerate(actual_temps)
            ]
            
        return result_dict