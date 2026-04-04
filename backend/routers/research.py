"""リサーチ APIルーター（経済指標・カレンダー・ニュース）"""
import logging
import os
import time
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/research", tags=["research"])

# ForexFactory RSS メモリキャッシュ
_ff_cache: dict = {"data": None, "ts": 0.0}
FF_TTL = 1800  # 30分

FOREXFACTORY_RSS = "https://nfs.faireconomy.media/ff_calendar_thisweek.xml"


@router.get("/fred/series")
async def list_fred_series():
    """人気の FRED シリーズ一覧を返す。"""
    from services.fred_client import get_popular_series_list
    return get_popular_series_list()


@router.get("/fred")
async def get_fred_series(
    series_id: Annotated[str, Query(description="FREDシリーズID")] = "DFF",
):
    """FRED から経済指標データを取得する。"""
    from services.fred_client import fetch_series
    api_key = os.environ.get("FRED_API_KEY")
    return fetch_series(series_id, api_key)


@router.get("/calendar")
async def get_economic_calendar():
    """Forexfactory から今週の経済カレンダーを取得する。"""
    now = time.time()
    if _ff_cache["data"] and (now - _ff_cache["ts"]) < FF_TTL:
        return {"source": "cache", "events": _ff_cache["data"]}

    events = await _fetch_forexfactory_events()
    _ff_cache["data"] = events
    _ff_cache["ts"] = now
    return {"source": "live", "events": events}


async def _fetch_forexfactory_events() -> list[dict]:
    try:
        import xml.etree.ElementTree as ET
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(FOREXFACTORY_RSS, headers={"User-Agent": "MT5Lab/1.0"})
            resp.raise_for_status()

        root = ET.fromstring(resp.text)
        channel = root.find("channel")
        if channel is None:
            return []

        events = []
        for item in channel.findall("item"):
            event = {
                "title": _text(item, "title"),
                "country": _text(item, "country"),
                "date": _text(item, "date"),
                "time": _text(item, "time"),
                "impact": _text(item, "impact"),
                "forecast": _text(item, "forecast"),
                "previous": _text(item, "previous"),
                "actual": _text(item, "actual"),
            }
            events.append(event)
        return events
    except Exception as e:
        logger.error("ForexFactory fetch error: %s", e)
        return []


def _text(el, tag: str) -> str:
    child = el.find(tag)
    return child.text.strip() if child is not None and child.text else ""


@router.get("/news")
async def get_news(
    q: Annotated[str, Query(description="検索キーワード")] = "USD JPY",
    page_size: Annotated[int, Query()] = 20,
):
    """NewsAPI からニュースを取得する。"""
    import httpx
    api_key = os.environ.get("NEWS_API_KEY")
    if not api_key:
        return {
            "articles": [],
            "error": "NEWS_API_KEY not configured",
            "note": "Set NEWS_API_KEY env variable to enable news",
        }

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": q,
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": page_size,
        "apiKey": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        articles = [
            {
                "title": a.get("title", ""),
                "description": a.get("description", ""),
                "url": a.get("url", ""),
                "published_at": a.get("publishedAt", ""),
                "source": a.get("source", {}).get("name", ""),
            }
            for a in data.get("articles", [])
        ]
        return {"articles": articles, "total": data.get("totalResults", 0)}
    except Exception as e:
        logger.error("NewsAPI error: %s", e)
        raise HTTPException(status_code=502, detail=f"NewsAPI error: {e}")
