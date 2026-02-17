import logging

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.TWIN_SERVER_URL,
            timeout=30.0,
        )
    return _client


async def close():
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


async def push_sensor_data(house_id: str, sensor_df: pd.DataFrame) -> dict:
    """Transform sensor DataFrame into room-based JSON and push to the server."""
    if sensor_df.empty:
        logger.warning("Empty sensor DataFrame — skipping push")
        return {}

    # Get the latest row
    latest = sensor_df.iloc[-1]
    timestamp = latest.get("Timestamp")
    if timestamp is None and hasattr(sensor_df.index, "dtype"):
        timestamp = sensor_df.index[-1]
    if hasattr(timestamp, "isoformat"):
        timestamp = timestamp.isoformat()

    # Find temperature columns to identify rooms
    temp_cols = [
        c for c in sensor_df.columns
        if c.endswith("_temperature") and "watermeter" not in c.lower()
    ]

    rooms = {}
    for temp_col in temp_cols:
        # Extract room prefix (everything before _temperature)
        room_prefix = temp_col.rsplit("_temperature", 1)[0]

        # Extract room name: strip the house prefix (e.g. "WONING_16__")
        parts = room_prefix.split("__", 1)
        room_name = parts[1] if len(parts) > 1 else parts[0]
        room_name = room_name.replace("_", " ")

        room_data = {}

        temp_val = latest.get(temp_col)
        if pd.notna(temp_val):
            room_data["temperature"] = round(float(temp_val), 2)

        set_col = f"{room_prefix}_set"
        if set_col in sensor_df.columns and pd.notna(latest.get(set_col)):
            room_data["temperature_set"] = round(float(latest[set_col]), 2)

        pir_col = f"{room_prefix}_pir"
        if pir_col in sensor_df.columns and pd.notna(latest.get(pir_col)):
            room_data["pir"] = int(latest[pir_col])

        if room_data:
            rooms[room_name] = room_data

    payload = {
        "houseId": house_id,
        "timestamp": str(timestamp),
        "rooms": rooms,
    }

    client = _get_client()
    try:
        response = await client.post("/api/twin/sensor-data", json=payload)
        response.raise_for_status()
        data = response.json()
        logger.info("Pushed sensor data for %d rooms to server", len(rooms))
        return data
    except httpx.HTTPStatusError as e:
        logger.error("Server returned %s: %s", e.response.status_code, e.response.text)
        raise
    except httpx.RequestError as e:
        logger.error("Failed to reach server: %s", e)
        raise


async def push_prediction(house_id: str, result: dict) -> dict:
    """Push prediction results to the server."""
    payload = {
        "houseId": house_id,
        "prediction": result,
    }

    client = _get_client()
    try:
        response = await client.post("/api/twin/predictions", json=payload)
        response.raise_for_status()
        data = response.json()
        logger.info("Pushed prediction to server successfully")
        return data
    except httpx.HTTPStatusError as e:
        logger.error("Server returned %s: %s", e.response.status_code, e.response.text)
        raise
    except httpx.RequestError as e:
        logger.error("Failed to reach server: %s", e)
        raise
