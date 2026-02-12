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


async def run_prediction_cycle():
    """Execute one full prediction cycle: fetch sensor data → predict → push results."""
    global last_prediction_time, last_prediction_result

    cycle_start = datetime.now(timezone.utc)
    logger.info("Prediction cycle started at %s", cycle_start.isoformat())

    try:
        # 1. Fetch sensor history from Calculus API
        logger.info("Fetching sensor data...")
        sensor_df = await sensor_client.fetch_sensor_data()

        if sensor_df.empty:
            logger.error("No sensor data retrieved — skipping prediction")
            return

        # 2. Run ML prediction
        logger.info("Running prediction model...")
        result = predictor.predict(sensor_df)

        # 3. Push prediction results to digital-twin server
        logger.info("Pushing prediction to twin server...")
        await twin_client.push_prediction(result)

        last_prediction_time = datetime.now(timezone.utc)
        last_prediction_result = result

        elapsed = (last_prediction_time - cycle_start).total_seconds()
        logger.info(
            "Prediction cycle completed in %.2fs — %d rooms predicted",
            elapsed,
            len(result.get("rooms", {})),
        )

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
        "Scheduler started — running every %d minutes",
        settings.PREDICTION_INTERVAL_MINUTES,
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
        "last_prediction_time": (
            last_prediction_time.isoformat() if last_prediction_time else None
        ),
        "next_scheduled_run": next_run,
        "last_prediction_result": last_prediction_result,
    }
