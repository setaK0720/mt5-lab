"""FRED API クライアント（fredapi ラッパー、遅延インポート）"""
import json
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache" / "fred"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_TTL = 86400  # 1日


POPULAR_SERIES = {
    "DFF": "フェデラルファンド金利",
    "CPIAUCSL": "消費者物価指数 (CPI)",
    "GDP": "GDP（名目）",
    "UNRATE": "失業率",
    "T10Y2Y": "10年-2年スプレッド",
    "DTWEXBGS": "ドル指数（広義）",
    "JPYUSD": "円ドルレート（FRED）",
}


def _cache_path(series_id: str) -> Path:
    return CACHE_DIR / f"{series_id}.json"


def _is_fresh(path: Path) -> bool:
    if not path.exists():
        return False
    return (time.time() - path.stat().st_mtime) < CACHE_TTL


def fetch_series(series_id: str, api_key: str | None = None) -> dict:
    """FRED からシリーズデータを取得する。

    Returns:
        {
            "series_id": str,
            "title": str,
            "observations": [{"date": "YYYY-MM-DD", "value": float}, ...]
        }
    """
    cache = _cache_path(series_id)
    if _is_fresh(cache):
        logger.info("FRED cache hit: %s", series_id)
        with open(cache) as f:
            return json.load(f)

    if api_key is None:
        import os
        api_key = os.environ.get("FRED_API_KEY")

    if not api_key:
        return {
            "series_id": series_id,
            "title": POPULAR_SERIES.get(series_id, series_id),
            "error": "FRED_API_KEY not configured",
            "observations": [],
        }

    try:
        from fredapi import Fred  # type: ignore
        fred = Fred(api_key=api_key)
        series = fred.get_series(series_id, observation_start="2000-01-01")
        info = fred.get_series_info(series_id)

        observations = [
            {"date": str(d.date()), "value": float(v)}
            for d, v in series.items()
            if not (v != v)  # NaN 除外
        ]
        result = {
            "series_id": series_id,
            "title": info.get("title", POPULAR_SERIES.get(series_id, series_id)),
            "observations": observations,
        }
        with open(cache, "w") as f:
            json.dump(result, f)
        return result

    except ImportError:
        logger.warning("fredapi not installed")
        return {
            "series_id": series_id,
            "title": POPULAR_SERIES.get(series_id, series_id),
            "error": "fredapi package not installed",
            "observations": [],
        }
    except Exception as e:
        logger.error("FRED fetch error: %s", e)
        return {
            "series_id": series_id,
            "title": POPULAR_SERIES.get(series_id, series_id),
            "error": str(e),
            "observations": [],
        }


def get_popular_series_list() -> list[dict]:
    return [{"id": k, "label": v} for k, v in POPULAR_SERIES.items()]
