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


# Dutch room name → standardized English name
_ROOM_NAME_MAP = {
    "living": "LivingRoom",
    "woonkamer": "LivingRoom",  # Fase-2 living room label
    "keuken": "Kitchen",
    "badkamer": "Bathroom",
    "hal beneden": "DownstairsHall",
    "hal boven": "UpstairsHall",
    "hal 1": "Hall1",  # Fase-2 halls are numbered, not floor-labelled
    "hal 2": "Hall2",
    "eetkamer": "DiningRoom",
    "slaapkamer 1": "Bedroom1",
    "slaapkamer 2": "Bedroom2",
    "slaapkamer 3": "Bedroom3",
    "bedroom 1": "Bedroom1",
    "bedroom 2": "Bedroom2",
    "bedroom 3": "Bedroom3",
}


def _extract_room_name(asset_name: str) -> str:
    """Extract the room/device name from 'HOUSE PREFIX - Room Name' and normalize to English."""
    parts = asset_name.split(" - ", 1)
    raw = parts[1].strip() if len(parts) > 1 else parts[0].strip()
    return _ROOM_NAME_MAP.get(raw.lower(), raw)


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


def _extract_fase2_rooms(latest: pd.Series, asset_name: str, columns) -> dict:
    """Group a single Fase-2 asset's source-prefixed columns into rooms.

    Fase-2 columns look like '<AssetPrefix>_<Device>_<Room>_<metric>'
    (e.g. 'Wonen_in_Limburg_6_WT101_Badkamer_temperature'). Several devices
    (AM307, WS202, WT101) can share a room; their fields are merged, with the
    first source alphabetically (AM307's ambient reading) winning over later
    ones (the WT101 valve reading) for shared keys such as temperature.
    """
    asset_prefix = _clean_prefix(asset_name)
    metrics_by_len = sorted(ROOM_FIELDS, key=len, reverse=True)

    # Discover the distinct '<AssetPrefix>_<Device>_<Room>' source prefixes by
    # stripping the known metric suffix off each column.
    source_prefixes = set()
    for col in columns:
        if col == "Timestamp" or not col.startswith(asset_prefix + "_"):
            continue
        for metric in metrics_by_len:
            if col.endswith("_" + metric):
                source_prefixes.add(col[: -(len(metric) + 1)])
                break

    rooms: dict[str, dict] = {}
    for src in sorted(source_prefixes):
        device, _, room_raw = src[len(asset_prefix) + 1:].partition("_")
        if not room_raw or device.lower() == "gateway":
            continue
        room_name = _extract_room_name(room_raw.replace("_", " "))
        fields = _extract_fields(latest, src, ROOM_FIELDS)
        bucket = rooms.setdefault(room_name, {})
        for key, value in fields.items():
            bucket.setdefault(key, value)
    return {name: data for name, data in rooms.items() if data}


def build_sensor_payload(house_id: str, sensor_df: pd.DataFrame) -> dict | None:
    """Transform a sensor DataFrame into the structured twin-server payload.

    Handles both layouts: Fase-1 homes (one Calculus asset per room, meter,
    appliance) and Fase-2 homes (one asset for the whole home, with sensors
    nested as per-room dataSources). Pure/synchronous so it can be dry-run.
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

    rooms: dict = {}
    meter: dict = {}
    appliances: dict = {}
    water: dict = {}

    if any(asset.get("fase2") for asset in assets):
        rooms = _extract_fase2_rooms(latest, assets[0]["name"], sensor_df.columns)
    else:
        meter_seen = False  # digitale meter and gasmeter share P1 data; deduplicate
        for asset in assets:
            asset_name = asset["name"]
            col_prefix = _clean_prefix(asset_name)
            asset_type = _classify_asset(asset_name)

            if asset_type == "room":
                data = _extract_fields(latest, col_prefix, ROOM_FIELDS)
                if data:
                    rooms[_extract_room_name(asset_name)] = data

            elif asset_type == "meter":
                if meter_seen:
                    # Merge additional meter fields (gasmeter may have gas.kuub)
                    extra = _extract_fields(latest, col_prefix, METER_FIELDS)
                    for k, v in extra.items():
                        meter.setdefault(k, v)
                else:
                    meter = _extract_fields(latest, col_prefix, METER_FIELDS)
                    meter_seen = True

            elif asset_type == "appliance":
                data = _extract_fields(latest, col_prefix, APPLIANCE_FIELDS)
                if data:
                    appliances[_extract_room_name(asset_name)] = data

            elif asset_type == "water":
                water = _extract_fields(latest, col_prefix, WATER_FIELDS)

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


async def push_sensor_data(house_id: str, sensor_df: pd.DataFrame) -> dict:
    """Build the structured payload and push it to the twin server."""
    payload = build_sensor_payload(house_id, sensor_df)
    if not payload:
        return {}

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
