import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


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


async def get_current_state() -> dict:
    """Fetch the current state from the digital-twin server."""
    client = _get_client()
    try:
        response = await client.get("/api/twin/state")
        response.raise_for_status()
        data = response.json()
        logger.info("Fetched twin state successfully")
        return data
    except httpx.HTTPStatusError as e:
        logger.error("Twin server returned %s: %s", e.response.status_code, e.response.text)
        raise
    except httpx.RequestError as e:
        logger.error("Failed to reach twin server: %s", e)
        raise


async def push_prediction(result: dict) -> dict:
    """Push prediction results to the digital-twin server."""
    client = _get_client()
    try:
        response = await client.post("/api/twin/predictions", json=result)
        response.raise_for_status()
        data = response.json()
        logger.info("Pushed prediction to twin server successfully")
        return data
    except httpx.HTTPStatusError as e:
        logger.error("Twin server returned %s: %s", e.response.status_code, e.response.text)
        raise
    except httpx.RequestError as e:
        logger.error("Failed to reach twin server: %s", e)
        raise
