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


# Raw Dutch room token (spaces→underscores, lower-cased) → app room key.
# Aligned with Calculus's phase-normalization mapping so Phase 1 and Phase 2
# collapse onto the same room keys: Living/Eetkamer→living room, Hal
# beneden↔Hal 1, Hal boven↔Hal 2.
_ROOM_NAME_MAP = {
    "living": "LivingRoom",
    "woonkamer": "LivingRoom",     # Fase-2 living-room label
    "eetkamer": "LivingRoom",      # Calculus: Eetkamer folds into the living room
    "keuken": "Kitchen",
    "badkamer": "Bathroom",
    "hal_beneden": "DownstairsHall",
    "hal_1": "DownstairsHall",     # Fase-2 'Hal 1' == 'Hal beneden'
    "hal_boven": "UpstairsHall",
    "hal_2": "UpstairsHall",       # Fase-2 'Hal 2' == 'Hal boven'
    "slaapkamer_1": "Bedroom1",
    "slaapkamer_2": "Bedroom2",
    "slaapkamer_3": "Bedroom3",
    "bedroom_1": "Bedroom1",
    "bedroom_2": "Bedroom2",
    "bedroom_3": "Bedroom3",
}

# Category (from the canonical column) → the field map used to read its metrics.
# Room categories are tried climate→motion→valve→door so an AM307 ambient
# reading wins over a WT101 valve reading for shared keys (e.g. temperature).
_ROOM_CATEGORIES = ("climate", "motion", "valve", "door")
_CATEGORY_FIELD_MAP = {
    "climate": ROOM_FIELDS,
    "motion": ROOM_FIELDS,
    "valve": ROOM_FIELDS,
    "door": ROOM_FIELDS,
    "meter": METER_FIELDS,
    "appliance": APPLIANCE_FIELDS,
    "water": WATER_FIELDS,
}


def _map_room(room_token: str) -> str:
    """Normalize a raw room token to its app room key (raw token if unknown)."""
    return _ROOM_NAME_MAP.get(room_token.lower(), room_token.replace("_", " "))


def _coerce(payload_key: str, val):
    """Coerce a raw reading to its payload representation."""
    if payload_key == "state":
        return str(val)
    try:
        return round(float(val), 2)
    except (ValueError, TypeError):
        return val


def build_sensor_payload(house_id: str, sensor_df: pd.DataFrame) -> dict | None:
    """Transform a sensor DataFrame into the structured twin-server payload.

    Both phases now arrive as one parent asset whose sensors are nested
    dataSources, flattened by sensor_client into canonical columns
    '<home>_<room>__<category>__<metric>'. This single path parses those
    columns: room categories (climate/motion/valve/door) are grouped and
    normalized into rooms, and meter/appliance/water categories are routed to
    their payload sections. Pure/synchronous so it can be dry-run.
    """
    if sensor_df.empty:
        logger.warning("Empty sensor DataFrame — skipping push")
        return None

    latest = sensor_df.iloc[-1]
    timestamp = latest.get("Timestamp")
    if timestamp is None and hasattr(sensor_df.index, "dtype"):
        timestamp = sensor_df.index[-1]
    if hasattr(timestamp, "isoformat"):
        timestamp = timestamp.isoformat()

    assets = sensor_client.HOUSES.get(house_id, [])
    if not assets:
        logger.warning("No assets configured for %s", house_id)
        return None

    home_prefix = _clean_prefix(assets[0]["name"]) + "_"

    rooms: dict = {}
    meter: dict = {}
    appliances: dict = {}
    water: dict = {}

    # Parse columns into (room_token, category, metric), then process room
    # categories in climate→motion→valve→door order so AM307 ambient readings
    # win over WT101 valve readings for shared keys (setdefault, first wins).
    parsed = []
    for col in sensor_df.columns:
        if col == "Timestamp" or not col.startswith(home_prefix):
            continue
        parts = col[len(home_prefix):].split("__")
        if len(parts) == 3:
            parsed.append((col, *parts))
    _order = {"climate": 0, "motion": 1, "valve": 2, "door": 3}
    parsed.sort(key=lambda p: _order.get(p[2], 9))

    for col, room_token, category, metric in parsed:
        field_map = _CATEGORY_FIELD_MAP.get(category)
        if not field_map:
            continue
        payload_key = field_map.get(metric)
        if payload_key is None:
            continue
        val = latest.get(col)
        if val is None or not pd.notna(val):
            continue
        value = _coerce(payload_key, val)

        if category in _ROOM_CATEGORIES:
            bucket = rooms.setdefault(_map_room(room_token), {})
            bucket.setdefault(payload_key, value)  # earlier category wins
        elif category == "meter":
            meter.setdefault(payload_key, value)
        elif category == "appliance":
            appliances.setdefault(room_token.replace("_", " "), {})[payload_key] = value
        elif category == "water":
            water.setdefault(payload_key, value)

    rooms = {name: data for name, data in rooms.items() if data}

    payload = {
        "houseId": house_id,
        "timestamp": str(timestamp),
        "rooms": rooms,
    }
    if meter:
        payload["meter"] = meter
    if appliances:
        payload["appliances"] = appliances
    if water:
        payload["water"] = water
    return payload


async def push_payload(payload: dict) -> dict:
    """POST an already-built sensor payload to the twin server."""
    house_id = payload["houseId"]
    client = _get_client()
    try:
        response = await client.post("/api/twin/sensor-data", json=payload)
        response.raise_for_status()
        data = response.json()
        logger.info(
            "Pushed sensor data for %s: %d rooms, meter=%s, %d appliances, water=%s",
            house_id, len(payload["rooms"]), "meter" in payload,
            len(payload.get("appliances", {})), "water" in payload,
        )
        return data
    except httpx.HTTPStatusError as e:
        logger.error("Server returned %s: %s", e.response.status_code, e.response.text)
        raise
    except httpx.RequestError as e:
        logger.error("Failed to reach server: %s", e)
        raise


async def push_sensor_data(house_id: str, sensor_df: pd.DataFrame) -> dict:
    """Build the structured payload and push it to the twin server."""
    payload = build_sensor_payload(house_id, sensor_df)
    if not payload:
        return {}
    return await push_payload(payload)


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
