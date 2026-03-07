import logging
import re

import httpx
import pandas as pd

from app.config import settings
from app.clients import sensor_client

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None

# --- Field maps: Calculus sensor_key → payload field name ---

ROOM_FIELDS = {
    "temperature": "temperature",
    "temperature.set": "temperature_set",
    "pir_status": "pir",
    "humidity": "humidity",
    "co2": "co2",
    "light_level": "light_level",
    "pressure": "pressure",
    "tvoc": "tvoc",
    "motor.position": "valve_position",
    "door.status": "door_status",
    "digital": "door_digital",
}

METER_FIELDS = {
    "positive_active_power": "positive_active_power",
    "negative_active_power": "negative_active_power",
    "gas.kuub": "gas_kuub",
    "tariff1.positive_active_energy": "tariff1_pos_energy",
    "tariff2.positive_active_energy": "tariff2_pos_energy",
    "tariff1.negative_active_energy": "tariff1_neg_energy",
    "tariff2.negative_active_energy": "tariff2_neg_energy",
    "current_tariff": "current_tariff",
    "phase_a.current": "phase_a_current",
}

APPLIANCE_FIELDS = {
    "active_power": "active_power",
    "current": "current",
    "voltage": "voltage",
    "total_active_energy": "total_active_energy",
    "state": "state",
}

WATER_FIELDS = {
    "pulsecounter.pulses": "pulse_count",
    "humidity": "humidity",
    "temperature": "temperature",
}

# Asset names that map to appliances
APPLIANCE_NAMES = {"TV", "Koelkast", "Wasmachine", "Droogkast", "Diepvries", "Koelkast/diepvries"}


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


def _clean_prefix(asset_name: str) -> str:
    """Compute the column prefix the same way sensor_client._fetch_asset does."""
    return re.sub(r"[^\w\s]", "", asset_name).strip().replace(" ", "_")


def _extract_room_name(asset_name: str) -> str:
    """Extract the room/device name from 'HOUSE PREFIX - Room Name'."""
    parts = asset_name.split(" - ", 1)
    return parts[1].strip() if len(parts) > 1 else parts[0].strip()


def _classify_asset(asset_name: str) -> str:
    """Classify an asset as 'meter', 'water', 'appliance', or 'room'."""
    name = _extract_room_name(asset_name).lower()
    if "digitale meter" in name or "gasmeter" in name:
        return "meter"
    if "watermeter" in name:
        return "water"
    # Check appliance names (case-insensitive)
    for app_name in APPLIANCE_NAMES:
        if name == app_name.lower():
            return "appliance"
    return "room"


def _extract_fields(latest: pd.Series, col_prefix: str, field_map: dict) -> dict:
    """Extract values from the latest row using a field map."""
    result = {}
    for sensor_key, payload_key in field_map.items():
        col_name = f"{col_prefix}_{sensor_key}"
        val = latest.get(col_name)
        if val is not None and pd.notna(val):
            if payload_key == "state":
                result[payload_key] = str(val)
            else:
                try:
                    result[payload_key] = round(float(val), 2)
                except (ValueError, TypeError):
                    result[payload_key] = val
    return result


async def push_sensor_data(house_id: str, sensor_df: pd.DataFrame) -> dict:
    """Transform sensor DataFrame into structured JSON and push to the server."""
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

    # Get asset list for this house
    assets = sensor_client.HOUSES.get(house_id, [])
    if not assets:
        logger.warning("No assets configured for %s", house_id)
        return {}

    rooms = {}
    meter = {}
    appliances = {}
    water = {}
    meter_seen = False  # digitale meter and gasmeter share P1 data; deduplicate

    for asset in assets:
        asset_name = asset["name"]
        col_prefix = _clean_prefix(asset_name)
        asset_type = _classify_asset(asset_name)

        if asset_type == "room":
            room_name = _extract_room_name(asset_name)
            data = _extract_fields(latest, col_prefix, ROOM_FIELDS)
            if data:
                rooms[room_name] = data

        elif asset_type == "meter":
            if meter_seen:
                # Merge additional meter fields (gasmeter may have gas.kuub)
                extra = _extract_fields(latest, col_prefix, METER_FIELDS)
                for k, v in extra.items():
                    if k not in meter:
                        meter[k] = v
            else:
                meter = _extract_fields(latest, col_prefix, METER_FIELDS)
                meter_seen = True

        elif asset_type == "appliance":
            app_name = _extract_room_name(asset_name)
            data = _extract_fields(latest, col_prefix, APPLIANCE_FIELDS)
            if data:
                appliances[app_name] = data

        elif asset_type == "water":
            water = _extract_fields(latest, col_prefix, WATER_FIELDS)

    payload = {
        "houseId": house_id,
        "timestamp": str(timestamp),
        "rooms": rooms,
    }

    # Only include non-empty optional sections
    if meter:
        payload["meter"] = meter
    if appliances:
        payload["appliances"] = appliances
    if water:
        payload["water"] = water

    client = _get_client()
    try:
        response = await client.post("/api/twin/sensor-data", json=payload)
        response.raise_for_status()
        data = response.json()
        logger.info(
            "Pushed sensor data for %s: %d rooms, meter=%s, %d appliances, water=%s",
            house_id, len(rooms), bool(meter), len(appliances), bool(water),
        )
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
