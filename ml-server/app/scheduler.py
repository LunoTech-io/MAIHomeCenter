import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.clients import twin_client, sensor_client
from app.ml import predictor

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()

last_prediction_time: datetime | None = None
last_prediction_result: dict | None = None


async def _process_house(house_id: str):
    """Fetch sensor data for a single house and push to server."""
    sensor_df = await sensor_client.fetch_sensor_data(house_id=house_id)

    if sensor_df.empty:
        logger.warning("No sensor data for %s — skipping", house_id)
        return None

    try:
        await twin_client.push_sensor_data(house_id, sensor_df)
    except Exception:
        logger.exception("Failed to push sensor data for %s", house_id)

    return sensor_df


async def run_prediction_cycle():
    """Execute one full prediction cycle: fetch sensor data for all houses, predict for woning16."""
    global last_prediction_time, last_prediction_result

    cycle_start = datetime.now(timezone.utc)
    logger.info("Prediction cycle started at %s", cycle_start.isoformat())

    try:
        all_house_ids = sensor_client.get_all_house_ids()
        logger.info("Processing %d houses...", len(all_house_ids))

        woning16_df = None

        for house_id in all_house_ids:
            try:
                sensor_df = await _process_house(house_id)
                if house_id == settings.HOUSE_ID and sensor_df is not None:
                    woning16_df = sensor_df
            except Exception:
                logger.exception("Failed to process house %s — continuing", house_id)

        # Run ML prediction only for the configured HOUSE_ID (woning16)
        if woning16_df is not None:
            logger.info("Running prediction model for %s...", settings.HOUSE_ID)
            result = predictor.predict(woning16_df)

            logger.info("Pushing prediction to server...")
            await twin_client.push_prediction(settings.HOUSE_ID, result)

            last_prediction_time = datetime.now(timezone.utc)
            last_prediction_result = result

        elapsed = (datetime.now(timezone.utc) - cycle_start).total_seconds()
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
        "Scheduler started — running every %d minutes for %d houses",
        settings.PREDICTION_INTERVAL_MINUTES,
        len(sensor_client.get_all_house_ids()),
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
        "last_prediction_time": (
            last_prediction_time.isoformat() if last_prediction_time else None
        ),
        "next_scheduled_run": next_run,
        "last_prediction_result": last_prediction_result,
    }
