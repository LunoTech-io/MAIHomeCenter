import asyncio
import logging
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)

# WONING 16 assets — update this list for different deployments
ASSETS = [
    {"id": 9274, "name": "WONING 16 - digitale meter"},
    {"id": 9825, "name": "WONING 16 - Badkamer"},
    {"id": 9834, "name": "WONING 16 - Eetkamer"},
    {"id": 9832, "name": "WONING 16 - Hal beneden"},
    {"id": 15481, "name": "WONING 16 - Hal boven"},
    {"id": 9826, "name": "WONING 16 - Keuken"},
    {"id": 9267, "name": "WONING 16 - Koelkast"},
    {"id": 9272, "name": "WONING 16 - Living"},
    {"id": 9269, "name": "WONING 16 - slaapkamer 1"},
    {"id": 9270, "name": "WONING 16 - slaapkamer 2"},
    {"id": 9271, "name": "WONING 16 - slaapkamer 3"},
    {"id": 9268, "name": "WONING 16 - TV"},
    {"id": 9266, "name": "WONING 16 - Wasmachine"},
    {"id": 9273, "name": "WONING 16 - watermeter"},
]


def _datetime_to_unix(dt: datetime) -> int:
    """Convert a timezone-aware datetime to a Unix timestamp."""
    dt_utc = dt.astimezone(ZoneInfo("UTC"))
    return int((dt_utc - datetime(1970, 1, 1, tzinfo=ZoneInfo("UTC"))).total_seconds())


def _extract_reading_data(data: dict, asset_id: int) -> list[dict]:
    """Extract flat reading records from the Calculus API response."""
    reading_data = []
    for source in data["dataSources"]:
        sensor_name = source["name"]
        for series in source["dataSeries"]:
            key_parts = series["key"].split("|")
            sensor_key = key_parts[1].split("#")[0]
            for entry in series["value"]:
                reading_data.append({
                    "SensorID": asset_id,
                    "SensorType": sensor_name,
                    "Timestamp": entry["key"],
                    sensor_key: entry["value"],
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


async def fetch_sensor_data(hours: int | None = None) -> pd.DataFrame:
    """Fetch and merge sensor data for all assets from the Calculus API."""
    if hours is None:
        hours = settings.SENSOR_HISTORY_HOURS

    end_time = datetime.now(ZoneInfo("UTC"))
    start_time = end_time - timedelta(hours=hours)

    logger.info("Fetching sensor data from %s to %s...", start_time, end_time)

    async with httpx.AsyncClient(
        headers={"CalculusApiKey": settings.CALCULUS_API_KEY},
        timeout=100.0,
    ) as client:
        tasks = [
            _fetch_asset(client, asset, start_time, end_time)
            for asset in ASSETS
        ]
        results = await asyncio.gather(*tasks)

    # Merge all asset DataFrames
    df = pd.DataFrame()
    for asset, result in zip(ASSETS, results):
        if result is None or result.empty:
            continue
        if df.empty:
            df = result
        else:
            df = pd.merge(df, result, on="Timestamp", how="outer")

    if not df.empty:
        df = df.sort_values("Timestamp").reset_index(drop=True)
        df = df.interpolate(method="linear").ffill().bfill()
        logger.info("Sensor data merged: %s", df.shape)
    else:
        logger.warning("No sensor data retrieved")

    return df
