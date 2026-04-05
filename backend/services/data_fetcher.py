"""MT5履歴OHLCVデータ取得層"""
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
    source: str = "mt5",
):
    """OHLCVデータを取得する。pandas DataFrame を返す。"""
    try:
        import pandas as pd
    except ImportError:
        raise RuntimeError(
            "pandas is not installed. "
            "Stop the server and run: pip install pandas plotly pyarrow"
        )

    cache_path = _cache_path(symbol, interval, source)

    if _is_cache_fresh(cache_path):
        try:
            logger.info("Cache hit: %s", cache_path)
            return pd.read_parquet(cache_path)
        except Exception as e:
            logger.warning("Cache read failed: %s", e)

    df = _fetch_from_mt5(symbol, interval, period)

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
        import MetaTrader5 as mt5
        from datetime import datetime, timedelta

        tf_attr = MT5_INTERVAL_MAP.get(interval, "TIMEFRAME_H1")
        tf = getattr(mt5, tf_attr, mt5.TIMEFRAME_H1)
        days = PERIOD_DAYS.get(period, 90)

        if not mt5.initialize():
            err = mt5.last_error()
            raise RuntimeError(f"MT5 initialize failed: {err}")

        if not mt5.symbol_select(symbol, True):
            raise RuntimeError(f"MT5: シンボル '{symbol}' をマーケットウォッチに追加できませんでした。(error={mt5.last_error()})")

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


def invalidate_cache(symbol: str, interval: str, source: str = "mt5") -> None:
    cache_path = _cache_path(symbol, interval, source)
    if cache_path.exists():
        cache_path.unlink()
