import logging

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


# Maps ml-server house keys to their LSTM model files
HOUSE_MODEL_MAP = {
    "woning16": "model_H01_lstm.pt",
    "weller1": "model_H02_lstm.pt",
    "weller2": "model_H03_lstm.pt",
    "weller4": "model_H04_lstm.pt",
    "wonenlimburg1": "model_H05_lstm.pt",
    "wonenlimburg2": "model_H06_lstm.pt",
    "wonenlimburg3": "model_H07_lstm.pt",
    "wonenlimburg4": "model_H08_lstm.pt",
    "wonenlimburg5": "model_H09_lstm.pt",
    "wonenzuid1": "model_H10_lstm.pt",
    "wonenzuid2": "model_H11_lstm.pt",
    "wonenzuid5": "model_H12_lstm.pt",
}


class Settings(BaseSettings):
    PORT: int = 8000
    TWIN_SERVER_URL: str = "http://localhost:5801"
    CALCULUS_API_URL: str = "https://api.calculus.group/v4"
    CALCULUS_API_KEY: str = ""
    PREDICTION_INTERVAL_MINUTES: int = 15
    SENSOR_HISTORY_HOURS: int = 24
    MODEL_DIR: str = "model"
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
