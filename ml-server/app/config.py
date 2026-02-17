import logging
import os

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


def _fetch_infisical_secrets() -> dict[str, str]:
    client_id = os.getenv("INFISICAL_CLIENT_ID", "")
    client_secret = os.getenv("INFISICAL_CLIENT_SECRET", "")
    project_id = os.getenv("INFISICAL_PROJECT_ID", "")

    if not (client_id and client_secret and project_id):
        logger.info("Infisical credentials not set — skipping remote secrets")
        return {}

    try:
        from infisical_sdk import InfisicalSDKClient

        client = InfisicalSDKClient(host="https://app.infisical.com")
        client.auth.universal_auth.login(
            client_id=client_id, client_secret=client_secret
        )

        response = client.secrets.list_secrets(
            project_id=project_id,
            environment_slug="prod",
            secret_path="/",
        )

        secrets = response.secrets if hasattr(response, "secrets") else response
        result = {s.secretKey: s.secretValue for s in secrets}
        logger.info("Fetched %d secret(s) from Infisical", len(result))
        return result
    except Exception:
        logger.exception("Failed to fetch secrets from Infisical")
        return {}


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
    INFISICAL_CLIENT_ID: str = ""
    INFISICAL_CLIENT_SECRET: str = ""
    INFISICAL_PROJECT_ID: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def __init__(self, **kwargs):
        infisical_secrets = _fetch_infisical_secrets()
        for key, value in infisical_secrets.items():
            if key not in os.environ:
                os.environ[key] = value
        super().__init__(**kwargs)


settings = Settings()
