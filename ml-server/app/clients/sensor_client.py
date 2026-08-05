import asyncio
import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

# All houses keyed by house_id, each mapped to its single Calculus "Woningen"
# parent asset (v4). Both phases expose the whole home as ONE asset whose
# sensors are nested dataSources — Phase 1 ("Woningen") and Phase 2
# ("Woningen - Fase 2") differ only in dataSource naming, which the unified
# parser in twin_client handles. Parent IDs resolved from GET /v4/assets.
HOUSES = {
    "woning16": [{"id": 9263, "name": "WONING 16", "phase": 1}],
    "weller1": [{"id": 10283, "name": "Weller 1", "phase": 1}],
    "weller2": [{"id": 10305, "name": "Weller 2", "phase": 1}],
    "weller3": [{"id": 10328, "name": "Weller 3", "phase": 1}],
    "weller4": [{"id": 10344, "name": "Weller 4", "phase": 1}],
    "weller5": [{"id": 10362, "name": "Weller 5", "phase": 1}],
    "wonenzuid1": [{"id": 9298, "name": "Wonen Zuid 1", "phase": 1}],
    "wonenzuid2": [{"id": 9504, "name": "Wonen Zuid 2", "phase": 1}],
    "wonenzuid3": [{"id": 9505, "name": "Wonen Zuid 3", "phase": 1}],
    "wonenzuid4": [{"id": 10419, "name": "Wonen Zuid 4", "phase": 1}],
    "wonenzuid5": [{"id": 10267, "name": "Wonen Zuid 5", "phase": 1}],
    "wonenlimburg1": [{"id": 10400, "name": "Wonen in Limburg 1", "phase": 1}],
    "wonenlimburg2": [{"id": 10437, "name": "Wonen in Limburg 2", "phase": 1}],
    "wonenlimburg3": [{"id": 9374, "name": "Wonen in Limburg 3", "phase": 1}],
    "wonenlimburg4": [{"id": 9375, "name": "Wonen in Limburg 4", "phase": 1}],
    "wonenlimburg5": [{"id": 9906, "name": "Wonen in Limburg 5", "phase": 1}],
    # Fase-2 homes ("Woningen - Fase 2").
    "wonenlimburg6": [{"id": 23660, "name": "Wonen in Limburg 6", "phase": 2}],
    "wonenlimburg7": [{"id": 23658, "name": "Wonen in Limburg 7", "phase": 2}],
    "wonenlimburg9": [{"id": 23659, "name": "Wonen in Limburg 9", "phase": 2}],
    "wonenlimburg10": [{"id": 23656, "name": "Wonen in Limburg 10", "phase": 2}],
    # Leefgoed — Fase-2 corporation.
    "leefgoed1": [{"id": 23663, "name": "Leefgoed 1", "phase": 2}],
    "leefgoed2": [{"id": 23664, "name": "Leefgoed 2", "phase": 2}],
    "leefgoed3": [{"id": 23665, "name": "Leefgoed 3", "phase": 2}],
    "leefgoed4": [{"id": 23666, "name": "Leefgoed 4", "phase": 2}],
    "leefgoed5": [{"id": 23667, "name": "Leefgoed 5", "phase": 2}],
    # Tiwos — Fase-2 corporation. Tiwos 1 has only a gateway (no room
    # sensors) until commissioned, so it pushes empty rooms for now.
    "tiwos1": [{"id": 23552, "name": "Tiwos 1", "phase": 2}],
    "tiwos3": [{"id": 23554, "name": "Tiwos 3", "phase": 2}],
    "tiwos4": [{"id": 23555, "name": "Tiwos 4", "phase": 2}],
    "tiwos5": [{"id": 23556, "name": "Tiwos 5", "phase": 2}],
}


def _datetime_to_unix(dt: datetime) -> int:
    """Convert a timezone-aware datetime to a Unix timestamp."""
    dt_utc = dt.astimezone(ZoneInfo("UTC"))
    return int((dt_utc - datetime(1970, 1, 1, tzinfo=ZoneInfo("UTC"))).total_seconds())


# Device-specific metric aliases → canonical metric. The Vicki thermostat
# (used instead of WT101 in some homes) reports its measured room temperature
# as 'temperature.current' and a separate 'temperature.status' flag; map the
# former to the canonical 'temperature' and drop the latter so it doesn't
# collide with it downstream.
_METRIC_ALIASES = {"temperature.current": "temperature"}
_DROP_METRICS = {"temperature.status"}

# dataSource names that carry no room (whole-home meters + the gateway).
_WHOLE_HOME_HINTS = (
    "energiemeter", "gasmeter", "digitale meter", "fluvius",
    "dnil", "lhi110", "gateway", "watermeter", "pulsecounter",
)


def _parse_source(source_name: str) -> tuple[str, str]:
    """Split a dataSource name into (device_token, raw_room).

    Both phases pack the whole home into one asset; each dataSource is one
    physical device. Phase 1 names them 'Device - Room' ('AM307 - Living',
    'WS523 - TV'); Phase 2 uses 'Device Room' ('AM307 Woonkamer',
    'WS202 Hal 1'). Whole-home sources (meters, gateway) carry no room.
    """
    name = source_name.strip()
    low = name.lower()
    if any(h in low for h in _WHOLE_HOME_HINTS):
        return name, ""
    if " - " in name:
        device, room = name.split(" - ", 1)
    elif " " in name:
        device, room = name.split(" ", 1)
    else:
        device, room = name, ""
    return device.strip(), room.strip()


def _classify_source(device: str) -> str:
    """Map a device token to a payload category the twin parser understands."""
    d = device.lower()
    if "am307" in d:
        return "climate"      # living-room air quality (temp/co2/humidity/…)
    if "ws202" in d:
        return "motion"       # per-room motion + light
    if "wt101" in d or "vicki" in d:
        return "valve"        # per-room temperature, setpoint, valve position
    if "elsys" in d or "ems" in d or "ws301" in d:
        return "door"         # per-room door / contact open-closed sensor
    if "ws523" in d or "enginko" in d:
        return "appliance"    # appliance-level consumption
    if "pulsecounter" in d or "watermeter" in d:
        return "water"
    if any(h in d for h in ("energiemeter", "gasmeter", "digitale meter", "fluvius", "dnil", "lhi110")):
        return "meter"        # electricity + gas
    if "gateway" in d:
        return "ignore"       # technical telemetry, not a home sensor
    return "climate"          # unknown room device → treat as a room reading


def _extract_reading_data(data: dict, asset_id: int) -> list[dict]:
    """Flatten a Calculus parent-asset response into canonical-column records.

    The whole home is one asset with per-device dataSources. Each series
    becomes a column named '<room>__<category>__<metric>' (room='Home' for
    whole-home sources), e.g. 'Living__climate__temperature',
    'Badkamer__valve__temperature.set', 'Home__meter__gas.kuub'. This single
    scheme spans both phases: the room token preserves the raw Dutch label
    (so the predictor's substring matching still works) while the category
    lets the twin parser group rooms and route meters/appliances/water
    without re-parsing device names. The gateway is dropped.
    """
    reading_data = []
    for source in data.get("dataSources", []):
        device, room = _parse_source(source["name"])
        category = _classify_source(device)
        if category == "ignore":
            continue
        room_token = re.sub(r"\s+", "_", room.strip()) or "Home"
        for series in source["dataSeries"]:
            key_parts = series["key"].split("|")
            raw = key_parts[1] if len(key_parts) > 1 else key_parts[0]
            sensor_key = raw.split("#")[0]
            if sensor_key in _DROP_METRICS:
                continue
            sensor_key = _METRIC_ALIASES.get(sensor_key, sensor_key)
            # Water is exposed as a pulsecounter key rather than its own source.
            if "pulsecounter" in sensor_key.lower():
                col_room, col_cat = "Home", "water"
            else:
                col_room, col_cat = room_token, category
            column = f"{col_room}__{col_cat}__{sensor_key}"
            for entry in series["value"]:
                reading_data.append({
                    "SensorID": asset_id,
                    "Timestamp": entry["key"],
                    column: entry["value"],
                })
    return reading_data


async def _fetch_asset(
    client: httpx.AsyncClient,
    asset: dict,
    start_time: datetime,
    end_time: datetime,
) -> pd.DataFrame | None:
    """Fetch and process data for a single asset."""
    asset_id = asset["id"]
    asset_name = asset["name"]
    clean_prefix = re.sub(r"[^\w\s]", "", asset_name).strip().replace(" ", "_")

    start_unix = _datetime_to_unix(start_time)
    end_unix = _datetime_to_unix(end_time)
    url = (
        f"{settings.CALCULUS_API_URL}/assets/{asset_id}/aggregateseries"
        f"?unixTimestampStart={start_unix}&unixTimestampEnd={end_unix}"
    )

    try:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
    except (httpx.HTTPStatusError, httpx.RequestError) as e:
        logger.error("Failed to fetch %s: %s", asset_name, e)
        return None

    reading_data = _extract_reading_data(data, asset_id)
    if not reading_data:
        return None

    df = pd.DataFrame(reading_data)
    df = df.groupby("Timestamp").agg("first").reset_index()
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])

    # Drop internal columns
    df = df.drop(columns=[c for c in ["SensorID", "SensorType"] if c in df.columns])

    # Rename columns with asset prefix (except Timestamp)
    new_cols = {col: f"{clean_prefix}_{col}" for col in df.columns if col != "Timestamp"}
    df = df.rename(columns=new_cols)

    logger.debug("Fetched %s: %d rows", asset_name, len(df))
    return df


async def fetch_sensor_data(house_id: str | None = None, hours: int | None = None) -> pd.DataFrame:
    """Fetch and merge sensor data for all assets of a given house."""
    if hours is None:
        hours = settings.SENSOR_HISTORY_HOURS

    if house_id is None:
        house_id = settings.HOUSE_ID

    assets = HOUSES.get(house_id)
    if not assets:
        logger.error("Unknown house_id: %s", house_id)
        return pd.DataFrame()

    end_time = datetime.now(ZoneInfo("UTC"))
    start_time = end_time - timedelta(hours=hours)

    logger.info("Fetching sensor data for %s from %s to %s...", house_id, start_time, end_time)

    async with httpx.AsyncClient(
        headers={"CalculusApiKey": settings.CALCULUS_API_KEY},
        timeout=100.0,
    ) as client:
        tasks = [
            _fetch_asset(client, asset, start_time, end_time)
            for asset in assets
        ]
        results = await asyncio.gather(*tasks)

    # Merge all asset DataFrames
    df = pd.DataFrame()
    for asset, result in zip(assets, results):
        if result is None or result.empty:
            continue
        if df.empty:
            df = result
        else:
            df = pd.merge(df, result, on="Timestamp", how="outer")

    if not df.empty:
        df = df.sort_values("Timestamp").reset_index(drop=True)
        # Coerce non-Timestamp columns to numeric (API may return strings)
        for col in df.columns:
            if col != "Timestamp":
                df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.interpolate(method="linear").ffill().bfill()
        logger.info("Sensor data for %s merged: %s", house_id, df.shape)
    else:
        logger.warning("No sensor data retrieved for %s", house_id)

    return df


def get_all_house_ids() -> list[str]:
    """Return all configured house IDs."""
    return list(HOUSES.keys())
