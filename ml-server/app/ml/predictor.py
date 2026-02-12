import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)


class DigitalTwinModel(nn.Module):
    def __init__(self, lookback_steps=144, forecast_steps=18):
        super().__init__()
        self.lookback_steps = lookback_steps
        self.forecast_steps = forecast_steps  # 18 steps * 10 min = 3 hours
        self.tz = ZoneInfo("Europe/Amsterdam")

        self.input_dim = None
        self.target_rooms = []
        self.net = None

    def prepare_clean_df(self, df_merged: pd.DataFrame) -> pd.DataFrame:
        df = df_merged.copy()
        if "Timestamp" in df.columns:
            df["Timestamp"] = pd.to_datetime(df["Timestamp"], utc=True)
            df.set_index("Timestamp", inplace=True)
        df = df.tz_convert(self.tz)

        # Filter out watermeter-related columns
        df = df[[c for c in df.columns if "watermeter" not in c.lower()]]

        # Identify target rooms (columns ending in 'temperature')
        self.target_rooms = [c for c in df.columns if c.lower().endswith("temperature")]

        # Keep only temperature, setpoint, and PIR features
        keywords = ["temperature", "set", "pir"]
        feature_cols = [c for c in df.columns if any(k in c.lower() for k in keywords)]
        df = df[feature_cols]

        # Resample to 10-min intervals
        df_resampled = df.resample("10min").agg(
            {c: ("max" if "pir" in c.lower() else "mean") for c in df.columns}
        )
        df_resampled = df_resampled.interpolate(method="linear").ffill().bfill()

        # Cyclical time encoding
        df_resampled["hour_sin"] = np.sin(2 * np.pi * df_resampled.index.hour / 24)
        df_resampled["hour_cos"] = np.cos(2 * np.pi * df_resampled.index.hour / 24)
        df_resampled["day_sin"] = np.sin(2 * np.pi * df_resampled.index.dayofweek / 7)
        df_resampled["day_cos"] = np.cos(2 * np.pi * df_resampled.index.dayofweek / 7)

        return df_resampled

    def dataframe_to_tensor(self, df_processed: pd.DataFrame) -> torch.Tensor:
        df = df_processed.copy()

        # Normalize temperatures: T_norm = (T_actual - 10) / 35
        temp_related = [c for c in df.columns if "temperature" in c.lower()]
        for col in temp_related:
            df[col] = (df[col] - 10) / 35

        pir_cols = [c for c in df.columns if "pir" in c.lower()]
        for col in pir_cols:
            df[col] = df[col].clip(0, 1)

        # Shift cyclical features to [0, 1]
        for col in ["hour_sin", "hour_cos", "day_sin", "day_cos"]:
            df[col] = (df[col] + 1) / 2

        df = df.clip(0, 1)

        if len(df) > self.lookback_steps:
            df = df.iloc[-self.lookback_steps :]

        self.input_dim = df.shape[1]
        return torch.tensor(df.values, dtype=torch.float32)

    def init_network(self, model_path=None):
        num_targets = len(self.target_rooms)
        output_dim = num_targets * self.forecast_steps

        self.net = nn.Sequential(
            nn.Flatten(),
            nn.Linear(self.lookback_steps * self.input_dim, 1024),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(1024, 512),
            nn.ReLU(),
            nn.Linear(512, output_dim),
        )

        if model_path:
            self.load_state_dict(torch.load(model_path, map_location="cpu", weights_only=True))
            self.eval()
            logger.info("Model weights loaded for %d rooms from %s", num_targets, model_path)
        else:
            logger.warning("No model path — using random weights for %d rooms", num_targets)

    def forward(self, x):
        return self.net(x)

    def predict_future(self, input_tensor: torch.Tensor) -> dict:
        if input_tensor.dim() == 2:
            x = input_tensor.unsqueeze(0)
        else:
            x = input_tensor

        with torch.no_grad():
            raw_out = self.forward(x)
            room_forecasts = raw_out.view(len(self.target_rooms), self.forecast_steps)

        result = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "meta": {
                "type": "Multi-Room Temperature Prediction",
                "horizon": "3 Hours",
                "resolution": "10 min",
                "model_version": "woning16-v1",
            },
            "rooms": {},
        }

        # Denormalize: T_actual = T_norm * 35 + 10
        for i, room_name in enumerate(self.target_rooms):
            room_data = room_forecasts[i].tolist()
            actual_temps = [round(t * 35 + 10, 2) for t in room_data]
            result["rooms"][room_name] = [
                {"offset_min": (j + 1) * 10, "temp": t}
                for j, t in enumerate(actual_temps)
            ]

        return result


# ── Module-level predictor state ──

_model: DigitalTwinModel | None = None
_model_path: str | None = None
_network_initialized: bool = False


def init(model_path: str):
    """Initialize the predictor. Call once at startup."""
    global _model, _model_path, _network_initialized
    _model = DigitalTwinModel(lookback_steps=144, forecast_steps=18)
    _model_path = model_path
    _network_initialized = False
    logger.info("Predictor initialized (model will load on first prediction)")


def predict(sensor_df: pd.DataFrame) -> dict:
    """Run the full prediction pipeline: preprocess → tensor → model → forecast."""
    global _network_initialized

    if _model is None:
        raise RuntimeError("Predictor not initialized — call init() first")

    clean_df = _model.prepare_clean_df(sensor_df)
    logger.info("Preprocessed data: %s, target rooms: %d", clean_df.shape, len(_model.target_rooms))

    input_tensor = _model.dataframe_to_tensor(clean_df)
    logger.info("Input tensor: %s", input_tensor.shape)

    if not _network_initialized:
        _model.init_network(model_path=_model_path)
        _network_initialized = True

    return _model.predict_future(input_tensor)
