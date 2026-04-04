"""yfinance + MT5履歴を統合したOHLCVデータ取得層"""
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache" / "ohlcv"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
CACHE_TTL = 3600  # 1時間


def _cache_path(symbol: str, interval: str, source: str) -> Path:
    safe = symbol.replace("/", "_").replace("=", "_")
    return CACHE_DIR / f"{source}_{safe}_{interval}.parquet"


def _is_cache_fresh(path: Path) -> bool:
    if not path.exists():
        return False
    return (time.time() - path.stat().st_mtime) < CACHE_TTL


def fetch_ohlcv(
    symbol: str,
    interval: str = "1h",
    period: str = "90d",
    source: str = "yfinance",
):
    """OHLCVデータを取得する。pandas DataFrame を返す。"""
    try:
        import pandas as pd
    except ImportError:
        raise RuntimeError(
            "pandas is not installed. "
            "Stop the server and run: pip install pandas yfinance plotly pyarrow fredapi httpx"
        )

    cache_path = _cache_path(symbol, interval, source)

    if _is_cache_fresh(cache_path):
        try:
            logger.info("Cache hit: %s", cache_path)
            return pd.read_parquet(cache_path)
        except Exception as e:
            logger.warning("Cache read failed: %s", e)

    if source == "mt5":
        df = _fetch_from_mt5(symbol, interval, period)
    else:
        df = _fetch_from_yfinance(symbol, interval, period)

    if df is not None and not df.empty:
        try:
            df.to_parquet(cache_path)
        except Exception as e:
            logger.warning("Cache write failed: %s", e)

    return df


# ── MT5 ────────────────────────────────────────────────────

MT5_INTERVAL_MAP = {
    "1m":  "TIMEFRAME_M1",
    "5m":  "TIMEFRAME_M5",
    "15m": "TIMEFRAME_M15",
    "30m": "TIMEFRAME_M30",
    "1h":  "TIMEFRAME_H1",
    "4h":  "TIMEFRAME_H4",
    "1d":  "TIMEFRAME_D1",
    "1wk": "TIMEFRAME_W1",
}

PERIOD_DAYS = {
    "7d": 7, "30d": 30, "90d": 90,
    "1y": 365, "2y": 730, "5y": 1825, "10y": 3650,
}


def _fetch_from_mt5(symbol: str, interval: str, period: str):
    """MT5から履歴OHLCVを取得する。MT5未接続時はエラーを返す。"""
    import pandas as pd

    try:
        import metatrader5 as mt5
        from datetime import datetime, timedelta

        tf_attr = MT5_INTERVAL_MAP.get(interval, "TIMEFRAME_H1")
        tf = getattr(mt5, tf_attr, mt5.TIMEFRAME_H1)
        days = PERIOD_DAYS.get(period, 90)

        if not mt5.initialize():
            err = mt5.last_error()
            raise RuntimeError(f"MT5 initialize failed: {err}")

        utc_to = datetime.utcnow()
        utc_from = utc_to - timedelta(days=days)
        rates = mt5.copy_rates_range(symbol, tf, utc_from, utc_to)

        if rates is None or len(rates) == 0:
            err = mt5.last_error()
            raise RuntimeError(
                f"MT5: {symbol} のデータが取得できませんでした。"
                f"シンボル名・MT5接続を確認してください。(error={err})"
            )

        df = pd.DataFrame(rates)
        df["datetime"] = pd.to_datetime(df["time"], unit="s")
        df = df.set_index("datetime")
        df = df.rename(columns={"tick_volume": "volume"})[
            ["open", "high", "low", "close", "volume"]
        ]
        logger.info("MT5: got %d rows for %s %s %s", len(df), symbol, interval, period)
        return df

    except RuntimeError:
        raise
    except Exception as e:
        logger.error("MT5 fetch error: %s", e)
        raise RuntimeError(f"MT5データ取得エラー: {e}")


# ── yfinance ───────────────────────────────────────────────

def _adjust_interval_yfinance(interval: str, period: str) -> str:
    """yfinance の取得上限に合わせて interval を自動調整する。"""
    period_days = PERIOD_DAYS.get(period, 90)
    adjusted = interval
    if interval in ("1m",) and period_days > 7:
        adjusted = "5m"
    elif interval in ("2m", "5m", "15m", "30m") and period_days > 60:
        adjusted = "1h"
    elif interval in ("1h", "4h") and period_days > 730:
        adjusted = "1d"
    if adjusted != interval:
        logger.warning("yfinance: interval '%s'→'%s'（period=%s）", interval, adjusted, period)
    return adjusted


def _fetch_from_yfinance(symbol: str, interval: str, period: str):
    import pandas as pd
    import yfinance as yf

    yf_interval = _adjust_interval_yfinance(interval, period)
    if yf_interval == "4h":
        yf_interval = "1h"

    try:
        logger.info("yfinance: fetching %s %s %s", symbol, yf_interval, period)
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=yf_interval, timeout=30)
        if df.empty:
            logger.warning("yfinance: empty data for %s", symbol)
            return pd.DataFrame()

        df.index = df.index.tz_localize(None) if df.index.tzinfo is not None else df.index
        df.columns = [c.lower() for c in df.columns]
        df = df[["open", "high", "low", "close", "volume"]].copy()
        df.index.name = "datetime"
        logger.info("yfinance: got %d rows for %s", len(df), symbol)
        return df
    except Exception as e:
        logger.error("yfinance fetch error: %s", e)
        return pd.DataFrame()


def invalidate_cache(symbol: str, interval: str, source: str = "yfinance") -> None:
    cache_path = _cache_path(symbol, interval, source)
    if cache_path.exists():
        cache_path.unlink()
