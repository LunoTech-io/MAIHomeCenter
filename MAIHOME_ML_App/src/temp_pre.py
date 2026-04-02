import os
import re
import pytz
import torch
import torch.nn as nn
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

# From your api_call
from src.api_call import query_endpoint, extract_reading_data

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

# ==========================================
# 1. Model Definition (MUST MATCH SAVED NAME)
# ==========================================
class Seq2SeqDigitalTwin(nn.Module):
    """The model class name must be 'Seq2SeqDigitalTwin' to match your H03 .pt file."""
    def __init__(self, input_dim, target_dim=7, hidden_dim=128, forecast_steps=36):
        super(Seq2SeqDigitalTwin, self).__init__()
        self.target_dim = target_dim
        self.forecast_steps = forecast_steps
        
        # Encoder
        self.encoder = nn.LSTM(input_dim, hidden_dim, num_layers=2, batch_first=True, dropout=0.2)
        # Decoder
        self.decoder_lstm = nn.LSTM(target_dim, hidden_dim, num_layers=2, batch_first=True, dropout=0.2)
        self.decoder_fc = nn.Linear(hidden_dim, target_dim)
        
    def forward(self, x, last_known_temps):
        _, (hidden, cell) = self.encoder(x)
        current_temp = last_known_temps.unsqueeze(1) 
        decoder_input = current_temp 
        outputs = []
        for t in range(self.forecast_steps):
            out, (hidden, cell) = self.decoder_lstm(decoder_input, (hidden, cell))
            step_delta = self.decoder_fc(out) 
            current_temp = current_temp + step_delta 
            outputs.append(current_temp)
            decoder_input = current_temp 
        return torch.cat(outputs, dim=1)

# Compatibility Alias (So both names work)
DigitalTwinModel = Seq2SeqDigitalTwin

# ==========================================
# 2. Data Loader Class
# ==========================================
class HouseDataLoader:
    HOUSE_CONFIG = {
        1:  {"prefix": "WONING 16", "save_name": "H01"},
        2:  {"prefix": "Weller 1", "save_name": "H02"},
        3:  {"prefix": "Weller 2", "save_name": "H03"},
        4:  {"prefix": "Weller 4", "save_name": "H04"},
        5:  {"prefix": "Wonen in Limburg 1", "save_name": "H05"},
        6:  {"prefix": "Wonen in Limburg 2", "save_name": "H06"},
        7:  {"prefix": "Wonen in Limburg 3", "save_name": "H07"},
        8:  {"prefix": "Wonen in Limburg 4", "save_name": "H08"},
        9:  {"prefix": "Wonen in Limburg 5", "save_name": "H09"},
        10: {"prefix": "Wonen Zuid 1", "save_name": "H10"},
        11: {"prefix": "Wonen Zuid 2", "save_name": "H11"},
        12: {"prefix": "Wonen Zuid 5", "save_name": "H12"} 
    }

    def __init__(self, headers):
        self.headers = headers

    def get_target_assets(self, all_assets, house_id):
        config = self.HOUSE_CONFIG.get(house_id)
        if not config: raise ValueError("❌ house_id must be 1-12")
        target_prefix = config["prefix"].lower()
        filtered = [a for a in all_assets if a.get("name", "").lower().startswith(target_prefix)]
        return filtered, config["prefix"], config["save_name"]

    def fetch_raw_house_data(self, house_id, all_assets, start_time, end_time):
        target_assets, house_name, save_name = self.get_target_assets(all_assets, house_id)
        print(f"\n📡 Fetching {save_name} ({house_name})")
        df = pd.DataFrame()
        for asset in target_assets:
            asset_id, asset_name = asset['id'], asset['name']
            clean_prefix = re.sub(r'[^\w\s]', '', asset_name).strip().replace(' ', '_')
            response = query_endpoint('aggregateseries', header=self.headers, assetid=asset_id, 
                                      start_time=start_time, end_time=end_time, dry_run=False)
            if response in ['Timeout', 'HTTP Error', 'Other API Error']: continue
            reading_data = extract_reading_data(response, asset_id)
            if not reading_data: continue
            df_temp = pd.DataFrame(reading_data)
            df_temp = df_temp.groupby('Timestamp').agg('first').reset_index()
            df_temp['Timestamp'] = pd.to_datetime(df_temp['Timestamp'])
            df_temp = df_temp.drop(columns=[c for c in ['SensorID', 'SensorType'] if c in df_temp.columns])
            df_temp = df_temp.rename(columns={col: f"{clean_prefix}_{col}" for col in df_temp.columns if col != 'Timestamp'})
            df = df_temp if df.empty else pd.merge(df, df_temp, on='Timestamp', how='outer')
        if not df.empty: df = df.sort_values('Timestamp').reset_index(drop=True)
        return df

    def process_api_data_to_model_format(self, raw_df):
        if raw_df is None or raw_df.empty: return None
        df = raw_df.copy().set_index('Timestamp') if 'Timestamp' in raw_df.columns else raw_df.copy()
        
        def normalize_col(col):
            c = col.lower()
            room = ""
            if 'digitale_meter' in c: room = "SmartMeter"
            elif 'living' in c: room = "LivingRoom"
            elif 'keuken' in c: room = "Kitchen"
            elif 'badkamer' in c: room = "Bathroom"
            elif 'hal_boven' in c: room = "UpstairsHall"
            elif 'hal_beneden' in c: room = "DownstairsHall"
            elif 'eetkamer' in c: room = "DiningRoom"
            elif 'slaapkamer_1' in c or 'bedroom_1' in c: room = "Bedroom1"
            elif 'slaapkamer_2' in c or 'bedroom_2' in c: room = "Bedroom2"
            elif 'slaapkamer_3' in c or 'bedroom_3' in c: room = "Bedroom3"
            
            param = ""
            if 'gas.kuub' in c: param = "gascube"
            elif 'pir_status' in c: param = "pirstatus"
            elif 'temperature.set' in c: param = "temperatureset" 
            elif 'temperature' in c: param = "temperature"
            return f"{room}_{param}" if room and param else col

        df = df.rename(columns=normalize_col)
        ordered_cols = [
            'SmartMeter_gascube', 'LivingRoom_pirstatus', 'LivingRoom_temperature',
            'DiningRoom_pirstatus', 'Kitchen_pirstatus', 'Kitchen_temperature', 'Kitchen_temperatureset',
            'Bathroom_pirstatus', 'Bathroom_temperature', 'Bathroom_temperatureset',
            'UpstairsHall_pirstatus', 'DownstairsHall_temperature', 'DownstairsHall_temperatureset',
            'Bedroom1_temperature', 'Bedroom1_temperatureset', 'Bedroom2_temperature', 'Bedroom2_temperatureset',
            'Bedroom3_temperature', 'Bedroom3_temperatureset'
        ]
        return df.reindex(columns=ordered_cols)

    def clean_and_resample(self, df_selected):
        df = df_selected.copy()
        df.index = pd.to_datetime(df.index, utc=True)
        df = df.tz_convert(pytz.timezone('Europe/Amsterdam'))
        df_res = df.resample('10min').agg({c: ('max' if 'pir' in c.lower() else 'mean') for c in df.columns})
        df_res = df_res.interpolate(method='linear').ffill().bfill()
        # Constants
        for c in df_res.columns:
            if df_res[c].isna().all():
                df_res[c] = 20.0 if ('temperature' in c.lower() or 'set' in c.lower()) else 0.0
            if 'gascube' in c.lower():
                diff = df_res[c].diff().mask(lambda x: (x<0)|(x>2.0)).interpolate()
                df_res[c] = diff.bfill().fillna(0.0)
        df_res['hour_sin'] = np.sin(2 * np.pi * df_res.index.hour / 24)
        df_res['hour_cos'] = np.cos(2 * np.pi * df_res.index.hour / 24)
        df_res['day_sin'] = np.sin(2 * np.pi * df_res.index.dayofweek / 7)
        df_res['day_cos'] = np.cos(2 * np.pi * df_res.index.dayofweek / 7)
        return df_res

# ==========================================
# 3. Predictor Class (Adapted for Seq2Seq)
# ==========================================
class TwinPredictor:
    def __init__(self, model_path, target_rooms, lookback_steps=144, forecast_steps=36):
        self.model_path = model_path
        self.target_rooms = target_rooms
        self.lookback_steps = lookback_steps
        self.forecast_steps = forecast_steps
        self.device = torch.device('cpu')
        
    def predict(self, df_clean):
        if len(df_clean) < self.lookback_steps:
            pad = pd.DataFrame([df_clean.iloc[0]]*(self.lookback_steps-len(df_clean)), index=[df_clean.index[0]-pd.Timedelta(minutes=10*i) for i in range(self.lookback_steps-len(df_clean),0,-1)])
            df_clean = pd.concat([pad, df_clean])
        df_input = df_clean.iloc[-self.lookback_steps:]

        # Normalization
        GLOBAL_GAS_MAX, TEMP_MIN, TEMP_RANGE = 0.2, 10, 35
        df_norm = df_input.copy()
        for c in df_norm.columns:
            if 'temperature' in c.lower() or 'set' in c.lower(): df_norm[c] = (df_norm[c]-TEMP_MIN)/TEMP_RANGE
            elif 'hour' in c.lower() or 'day' in c.lower(): df_norm[c] = (df_norm[c]+1)/2
            elif 'gascube' in c.lower(): df_norm[c] = df_norm[c]/GLOBAL_GAS_MAX
        df_norm = df_norm.fillna(0).clip(0, 1)

        # Seq2Seq Inputs
        input_tensor = torch.tensor(df_norm.values, dtype=torch.float32).unsqueeze(0)
        target_idx = [df_norm.columns.get_loc(r) for r in self.target_rooms]
        last_temps = torch.tensor(df_norm.iloc[-1, target_idx].values.astype(np.float32)).unsqueeze(0)

        # Load & Infer
        try:
            # 🌟 IMPORTANT: This needs Seq2SeqDigitalTwin defined in the same file
            model = torch.load(self.model_path, map_location=self.device, weights_only=False)
            model.eval()
            with torch.no_grad():
                # H03 model is Seq2Seq, it takes TWO inputs: (x, last_known_temps)
                raw_output = model(input_tensor, last_temps)
                pred_norm = raw_output.squeeze(0).numpy()
        except Exception as e:
            print(f" Inference error: {e}")
            return None, None

        # Assemble JSON
        res = {"meta": {"horizon": "6 Hours"}, "rooms": {}}
        for i, room in enumerate(self.target_rooms):
            res["rooms"][room] = [{"offset_min": (s+1)*10, "temp": round(float(pred_norm[s,i]*TEMP_RANGE+TEMP_MIN), 2)} for s in range(self.forecast_steps)]
        return res, df_input

    def plot(self, df_clean, prediction_results, max_rooms=7):
        print("🎨 Generating Plot...")
        reference_time = df_clean.index[-1].tz_localize(None)
        plot_rooms = [r for r in self.target_rooms if r in prediction_results['rooms']][:max_rooms]
        num_rooms = len(plot_rooms)
        
        if num_rooms == 0:
            print("❌ No matching room data found for plotting.")
            return

        fig, axes = plt.subplots(num_rooms, 1, figsize=(12, 4 * num_rooms), sharex=True)
        if num_rooms == 1: axes = [axes]

        try:
            for ax, room in zip(axes, plot_rooms):
                # 1. Plot Past 24h Actuals
                h_times = df_clean.index.tz_localize(None)
                ax.plot(h_times, df_clean[room], label='Past 24h (Actual)', color='#1f77b4', linewidth=1.5)
                
                display_name = room.replace("_temperature", "").split("__")[-1]
                p_data = prediction_results["rooms"][room]

                # 2. Check if sensor is offline (String) or active (List)
                if isinstance(p_data, str):
                    # Sensor is offline: Set a red title and skip forecast plotting
                    ax.set_title(f"Room: {display_name} [SENSOR OFFLINE]", fontsize=12, fontweight='bold', loc='left', color='#d62728')
                else:
                    # Sensor is active: Plot forecast
                    pred_temps = [item["temp"] for item in p_data]
                    last_val = df_clean[room].iloc[-1]
                    
                    pred_times = [reference_time + pd.Timedelta(minutes=item["offset_min"]) for item in p_data]
                    full_pred_times = [reference_time] + pred_times
                    full_pred_temps = [last_val] + pred_temps
                    
                    ax.plot(full_pred_times, full_pred_temps, 
                            label='Digital Twin Forecast (6h)', color='#d62728', 
                            marker='o', markersize=3, linestyle='--', linewidth=2)
                    
                    ax.set_title(f"Room: {display_name}", fontsize=12, fontweight='bold', loc='left')

                # 3. Formatting
                ax.set_ylabel("Temp (°C)")
                ax.autoscale(enable=True, axis='y', tight=False)
                y_min, y_max = ax.get_ylim()
                
                # Prevent tiny noise from looking like huge spikes
                if (y_max - y_min) < 3.0:
                    mid = (y_max + y_min) / 2
                    ax.set_ylim(mid - 1.5, mid + 1.5)
                
                ax.axvline(x=reference_time, color='gray', linestyle=':', alpha=0.8)
                ax.grid(True, which='both', linestyle='--', alpha=0.4)
                ax.legend(loc='upper left', fontsize=9)
                ax.xaxis.set_major_formatter(mdates.DateFormatter('%H:%M'))

            plt.xlabel("Time (Local)")
            plt.xticks(rotation=45)
            plt.tight_layout()
            plt.show()

        except Exception as e:
            print(f"❌ Error during plotting: {e}")
        finally:
            plt.close('all')