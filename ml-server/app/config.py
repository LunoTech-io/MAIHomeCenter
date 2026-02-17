from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PORT: int = 8000
    TWIN_SERVER_URL: str = "http://localhost:3001"
    CALCULUS_API_URL: str = "https://api.calculus.group/v3"
    CALCULUS_API_KEY: str = ""
    HOUSE_ID: str = "woning16"
    PREDICTION_INTERVAL_MINUTES: int = 15
    SENSOR_HISTORY_HOURS: int = 24
    MODEL_PATH: str = "model/woning16_model.pth"
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
