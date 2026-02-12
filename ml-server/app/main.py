import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.scheduler import start_scheduler, stop_scheduler, get_status
from app.clients import twin_client
from app.ml import predictor

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ML server...")
    predictor.init(settings.MODEL_PATH)
    start_scheduler()
    yield
    logger.info("Shutting down ML server...")
    stop_scheduler()
    await twin_client.close()


app = FastAPI(
    title="MAIHome ML Server",
    description="ML prediction service for the MAIHome digital twin",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.TWIN_SERVER_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    status = get_status()
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scheduler_running": status["scheduler_running"],
    }


@app.get("/api/ml/status")
async def ml_status():
    return get_status()
