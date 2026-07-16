import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings, HOUSE_MODEL_MAP
from app.clients import twin_client, sensor_client
from app.ml import predictor

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

last_prediction_time: datetime | None = None
last_prediction_results: dict[str, dict] = {}
# Per-house data-health, updated every cycle. A house is "dark" when all its
# sensors report only nulls (offline), which yields a payload with no rooms.
house_health: dict[str, dict] = {}


async def _process_house(house_id: str):
    """Fetch sensor data, record data health, and push to the twin server.

    Returns the sensor DataFrame when the house has live room data (so a
    prediction can run), or None when the house is dark — Calculus returns a
    grid of null readings for offline homes, which parses to an empty payload.
    Predicting on that would feed the LSTM all-NaN input, so we skip it.
    """
    sensor_df = await sensor_client.fetch_sensor_data(house_id=house_id)
    payload = twin_client.build_sensor_payload(house_id, sensor_df)
    rooms_n = len(payload["rooms"]) if payload else 0

    now = datetime.now(timezone.utc)
    health = house_health.setdefault(house_id, {"last_live_at": None})
    health["checked_at"] = now.isoformat()
    health["rooms"] = rooms_n
    health["live"] = rooms_n > 0
    if rooms_n > 0:
        health["last_live_at"] = now.isoformat()

    if rooms_n == 0:
        logger.warning("No live sensor data for %s (dark) — skipping push", house_id)
        return None

    try:
        await twin_client.push_payload(payload)
    except Exception:
        logger.exception("Failed to push sensor data for %s", house_id)

    return sensor_df


async def run_prediction_cycle():
    """Execute one full prediction cycle: fetch sensor data for all houses, predict for those with models."""
    global last_prediction_time, last_prediction_results

    cycle_start = datetime.now(timezone.utc)
    logger.info("Prediction cycle started at %s", cycle_start.isoformat())

    try:
        all_house_ids = sensor_client.get_all_house_ids()
        logger.info("Processing %d houses...", len(all_house_ids))

        for house_id in all_house_ids:
            try:
                sensor_df = await _process_house(house_id)

                if sensor_df is not None and house_id in HOUSE_MODEL_MAP:
                    logger.info("Running prediction for %s...", house_id)
                    result = predictor.predict(house_id, sensor_df)

                    if result is not None:
                        await twin_client.push_prediction(house_id, result)
                        last_prediction_results[house_id] = result

            except Exception:
                logger.exception("Failed to process house %s — continuing", house_id)

        last_prediction_time = datetime.now(timezone.utc)
        elapsed = (last_prediction_time - cycle_start).total_seconds()
        logger.info("Prediction cycle completed in %.2fs", elapsed)

    except Exception:
        logger.exception("Prediction cycle failed")


def start_scheduler():
    """Configure and start the APScheduler."""
    scheduler.add_job(
        run_prediction_cycle,
        trigger=IntervalTrigger(minutes=settings.PREDICTION_INTERVAL_MINUTES),
        id="prediction_cycle",
        name="ML Prediction Cycle",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Scheduler started — running every %d minutes for %d houses (%d with models)",
        settings.PREDICTION_INTERVAL_MINUTES,
        len(sensor_client.get_all_house_ids()),
        len(HOUSE_MODEL_MAP),
    )


def stop_scheduler():
    """Shut down the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")


def get_status() -> dict:
    """Return scheduler and last prediction status."""
    job = scheduler.get_job("prediction_cycle")
    next_run = job.next_run_time.isoformat() if job and job.next_run_time else None

    return {
        "scheduler_running": scheduler.running,
        "prediction_interval_minutes": settings.PREDICTION_INTERVAL_MINUTES,
        "houses": sensor_client.get_all_house_ids(),
        "houses_with_models": list(HOUSE_MODEL_MAP.keys()),
        "last_prediction_time": (
            last_prediction_time.isoformat() if last_prediction_time else None
        ),
        "next_scheduled_run": next_run,
        "last_prediction_houses": list(last_prediction_results.keys()),
        "house_health": house_health,
    }


def get_health() -> dict:
    """Summarize per-house data health: which houses are live vs dark."""
    live = sorted(h for h, v in house_health.items() if v.get("live"))
    dark = sorted(h for h, v in house_health.items() if not v.get("live"))
    return {
        "checked": bool(house_health),
        "total": len(house_health),
        "live_count": len(live),
        "dark_count": len(dark),
        "dark_houses": dark,
        "houses": house_health,
    }
