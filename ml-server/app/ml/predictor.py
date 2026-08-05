import logging
import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

# Cap CPU threads BEFORE importing torch. In a container, torch sizes its thread
# pools from the host's core count (48 here), not the cgroup CPU quota (4 cores).
# That oversubscription turns a sub-second batch-1 LSTM forward pass into a 50s+
# CPU-pinning stall. For this workload a small fixed thread count is both faster
# and far cheaper. OMP/MKL must be set before torch is imported to take effect.
_TORCH_THREADS = max(1, int(os.environ.get("ML_TORCH_THREADS", "1")))
os.environ.setdefault("OMP_NUM_THREADS", str(_TORCH_THREADS))
os.environ.setdefault("MKL_NUM_THREADS", str(_TORCH_THREADS))

import numpy as np
import pandas as pd
import torch
import torch.nn as nn

from app.config import HOUSE_MODEL_MAP

logger = logging.getLogger(__name__)

# Runtime cap as well, in case the env vars were already set elsewhere.
torch.set_num_threads(_TORCH_THREADS)
try:
    torch.set_num_interop_threads(_TORCH_THREADS)
except RuntimeError:
    # interop count can only be set before any parallel work has started
    pass
logger.info(
    "torch threads capped to %d (host reports %d cores)",
    _TORCH_THREADS, os.cpu_count() or -1,
)

# ── Constants ──

LOOKBACK_STEPS = 144   # 24 hours at 10-min intervals
FORECAST_STEPS = 36    # 6 hours at 10-min intervals
TEMP_MIN = 10
TEMP_RANGE = 35
GLOBAL_GAS_MAX = 0.2

ORDERED_COLS = [
    "SmartMeter_gascube", "LivingRoom_pirstatus", "LivingRoom_temperature",
    "DiningRoom_pirstatus", "Kitchen_pirstatus", "Kitchen_temperature", "Kitchen_temperatureset",
    "Bathroom_pirstatus", "Bathroom_temperature", "Bathroom_temperatureset",
    "UpstairsHall_pirstatus", "DownstairsHall_temperature", "DownstairsHall_temperatureset",
    "Bedroom1_temperature", "Bedroom1_temperatureset", "Bedroom2_temperature", "Bedroom2_temperatureset",
    "Bedroom3_temperature", "Bedroom3_temperatureset",
]

TARGET_ROOMS = [
    "LivingRoom_temperature", "Kitchen_temperature", "Bathroom_temperature",
    "DownstairsHall_temperature", "Bedroom1_temperature", "Bedroom2_temperature",
    "Bedroom3_temperature",
]


# ── Model definition (must match saved model class name) ──

class Seq2SeqDigitalTwin(nn.Module):
    def __init__(self, input_dim, target_dim=7, hidden_dim=128, forecast_steps=36):
        super().__init__()
        self.target_dim = target_dim
        self.forecast_steps = forecast_steps
        self.encoder = nn.LSTM(input_dim, hidden_dim, num_layers=2, batch_first=True, dropout=0.2)
        self.decoder_lstm = nn.LSTM(target_dim, hidden_dim, num_layers=2, batch_first=True, dropout=0.2)
        self.decoder_fc = nn.Linear(hidden_dim, target_dim)

    def forward(self, x, last_known_temps):
        _, (hidden, cell) = self.encoder(x)
        current_temp = last_known_temps.unsqueeze(1)
        decoder_input = current_temp
        outputs = []
        for _ in range(self.forecast_steps):
            out, (hidden, cell) = self.decoder_lstm(decoder_input, (hidden, cell))
            step_delta = self.decoder_fc(out)
            current_temp = current_temp + step_delta
            outputs.append(current_temp)
            decoder_input = current_temp
        return torch.cat(outputs, dim=1)


# Compatibility alias so torch.load can resolve either name
DigitalTwinModel = Seq2SeqDigitalTwin

# Register in __main__ so torch.load can unpickle models saved from scripts
import sys
_main = sys.modules.get("__main__")
if _main is not None:
    _main.Seq2SeqDigitalTwin = Seq2SeqDigitalTwin
    _main.DigitalTwinModel = DigitalTwinModel


# ── Column normalization (Dutch asset names → standard English) ──

def _normalize_col(col: str) -> str:
    c = col.lower()
    room = ""
    if "digitale_meter" in c or "__meter__" in c:
        # v4 canonical meter column '<home>_Home__meter__gas.kuub'
        room = "SmartMeter"
    elif "living" in c:
        room = "LivingRoom"
    elif "keuken" in c:
        room = "Kitchen"
    elif "badkamer" in c:
        room = "Bathroom"
    elif "hal_boven" in c:
        room = "UpstairsHall"
    elif "hal_beneden" in c:
        room = "DownstairsHall"
    elif "eetkamer" in c:
        room = "DiningRoom"
    elif "slaapkamer_1" in c or "bedroom_1" in c:
        room = "Bedroom1"
    elif "slaapkamer_2" in c or "bedroom_2" in c:
        room = "Bedroom2"
    elif "slaapkamer_3" in c or "bedroom_3" in c:
        room = "Bedroom3"

    param = ""
    if "gas.kuub" in c or "gaskuub" in c:
        param = "gascube"
    elif "pir_status" in c:
        param = "pirstatus"
    elif "temperature.set" in c or "temperatureset" in c:
        param = "temperatureset"
    elif "temperature" in c:
        param = "temperature"

    return f"{room}_{param}" if room and param else col


# ── Preprocessing pipeline ──

def _process_to_model_format(sensor_df: pd.DataFrame) -> pd.DataFrame | None:
    """Normalize column names and select the ordered feature set."""
    if sensor_df is None or sensor_df.empty:
        return None

    df = sensor_df.copy()
    if "Timestamp" in df.columns:
        df["Timestamp"] = pd.to_datetime(df["Timestamp"], utc=True)
        df.set_index("Timestamp", inplace=True)

    df = df.rename(columns=_normalize_col)
    # Two raw columns can normalize to the same feature (e.g. a device that
    # reports several temperature.* variants). Collapse duplicates to the first
    # non-null so reindex doesn't choke on duplicate labels.
    if df.columns.duplicated().any():
        df = df.T.groupby(level=0).first().T
    return df.reindex(columns=ORDERED_COLS)


def _clean_and_resample(df: pd.DataFrame) -> tuple[pd.DataFrame, set[str]]:
    """Resample to 10-min, handle gas differencing, fill NaNs, add time features.

    Returns the cleaned DataFrame and a set of offline target room columns
    (those that were entirely NaN before filling).
    """
    df = df.copy()
    df.index = pd.to_datetime(df.index, utc=True)
    tz = ZoneInfo("Europe/Amsterdam")
    df = df.tz_convert(tz)

    df_res = df.resample("10min").agg(
        {c: ("max" if "pir" in c.lower() else "mean") for c in df.columns}
    )
    df_res = df_res.interpolate(method="linear").ffill().bfill()

    # Detect offline rooms before filling NaN columns with defaults
    offline = set()
    for room in TARGET_ROOMS:
        if room in df_res.columns and df_res[room].isna().all():
            offline.add(room)

    for c in df_res.columns:
        if df_res[c].isna().all():
            df_res[c] = 20.0 if ("temperature" in c.lower() or "set" in c.lower()) else 0.0
        if "gascube" in c.lower():
            diff = df_res[c].diff().mask(lambda x: (x < 0) | (x > 2.0)).interpolate()
            df_res[c] = diff.bfill().fillna(0.0)

    df_res["hour_sin"] = np.sin(2 * np.pi * df_res.index.hour / 24)
    df_res["hour_cos"] = np.cos(2 * np.pi * df_res.index.hour / 24)
    df_res["day_sin"] = np.sin(2 * np.pi * df_res.index.dayofweek / 7)
    df_res["day_cos"] = np.cos(2 * np.pi * df_res.index.dayofweek / 7)

    return df_res, offline


# ── Module-level state ──

_model_dir: str | None = None
_models: dict[str, nn.Module] = {}


def init(model_dir: str):
    """Initialize the predictor with the model directory. Models are lazy-loaded."""
    global _model_dir
    _model_dir = model_dir
    logger.info("Predictor initialized with model_dir=%s (lazy loading)", model_dir)


def _load_model(house_id: str) -> nn.Module | None:
    """Load and cache a house-specific model."""
    if house_id in _models:
        return _models[house_id]

    model_file = HOUSE_MODEL_MAP.get(house_id)
    if not model_file:
        return None

    model_path = os.path.join(_model_dir, model_file)
    if not os.path.exists(model_path):
        logger.error("Model file not found: %s", model_path)
        return None

    logger.info("Loading model for %s from %s", house_id, model_path)
    model = torch.load(model_path, map_location="cpu", weights_only=False)
    model.eval()
    _models[house_id] = model
    return model


def predict(house_id: str, sensor_df: pd.DataFrame) -> dict | None:
    """Run the full prediction pipeline for a house."""
    if _model_dir is None:
        raise RuntimeError("Predictor not initialized — call init() first")

    if house_id not in HOUSE_MODEL_MAP:
        logger.debug("No model available for %s — skipping prediction", house_id)
        return None

    # 1. Normalize columns to standard names
    df_model = _process_to_model_format(sensor_df)
    if df_model is None:
        logger.warning("No data after column normalization for %s", house_id)
        return None

    # 2. Clean, resample, add time features + detect offline sensors
    df_clean, offline_rooms = _clean_and_resample(df_model)
    logger.info("Preprocessed %s: %s", house_id, df_clean.shape)

    if offline_rooms:
        logger.info("Offline sensors for %s: %s", house_id, offline_rooms)

    # 4. Pad if not enough data
    if len(df_clean) < LOOKBACK_STEPS:
        pad_count = LOOKBACK_STEPS - len(df_clean)
        pad = pd.DataFrame(
            [df_clean.iloc[0]] * pad_count,
            index=[df_clean.index[0] - pd.Timedelta(minutes=10 * i) for i in range(pad_count, 0, -1)],
        )
        df_clean = pd.concat([pad, df_clean])

    df_input = df_clean.iloc[-LOOKBACK_STEPS:]

    # 5. Normalize values
    df_norm = df_input.copy()
    for c in df_norm.columns:
        if "temperature" in c.lower() or "set" in c.lower():
            df_norm[c] = (df_norm[c] - TEMP_MIN) / TEMP_RANGE
        elif "hour" in c.lower() or "day" in c.lower():
            df_norm[c] = (df_norm[c] + 1) / 2
        elif "gascube" in c.lower():
            df_norm[c] = df_norm[c] / GLOBAL_GAS_MAX
    df_norm = df_norm.fillna(0).clip(0, 1)

    # 6. Build tensors
    input_tensor = torch.tensor(df_norm.values, dtype=torch.float32).unsqueeze(0)
    target_idx = [df_norm.columns.get_loc(r) for r in TARGET_ROOMS]
    last_temps = torch.tensor(
        df_norm.iloc[-1, target_idx].values.astype(np.float32)
    ).unsqueeze(0)

    # 7. Load model and run inference
    model = _load_model(house_id)
    if model is None:
        return None

    with torch.no_grad():
        raw_output = model(input_tensor, last_temps)
        pred_norm = raw_output.squeeze(0).numpy()

    # 8. Build result
    result = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "meta": {
            "type": "Multi-Room Temperature Prediction",
            "horizon": "6 Hours",
            "resolution": "10 min",
            "model_version": "seq2seq-lstm-v1",
            "house_id": house_id,
        },
        "rooms": {},
    }

    for i, room in enumerate(TARGET_ROOMS):
        if room in offline_rooms:
            result["rooms"][room] = "Sensor Offline"
        else:
            result["rooms"][room] = [
                {"offset_min": (s + 1) * 10, "temp": round(float(pred_norm[s, i] * TEMP_RANGE + TEMP_MIN), 2)}
                for s in range(FORECAST_STEPS)
            ]

    logger.info("Prediction complete for %s: %d rooms (%d offline)", house_id, len(TARGET_ROOMS), len(offline_rooms))
    return result
