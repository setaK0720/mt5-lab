"""MT5バー・ティックデータの取得・永続保存サービス"""
import logging
from datetime import datetime
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

BARS_DIR  = Path(__file__).parent.parent / "data" / "bars"
TICKS_DIR = Path(__file__).parent.parent / "data" / "ticks"
BARS_DIR.mkdir(parents=True, exist_ok=True)
TICKS_DIR.mkdir(parents=True, exist_ok=True)

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


def _date_str(dt: datetime) -> str:
    return dt.strftime("%Y%m%d")


def _parse_date(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d")


# ── バーデータ ───────────────────────────────────────────────

def fetch_and_save_bars(symbol: str, interval: str, date_from: str, date_to: str) -> str:
    """MT5 copy_rates_range でバーデータを取得し parquet 保存。file_id を返す。"""
    import metatrader5 as mt5

    dt_from = _parse_date(date_from)
    dt_to   = _parse_date(date_to)

    tf_attr = MT5_INTERVAL_MAP.get(interval, "TIMEFRAME_H1")

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")

    tf = getattr(mt5, tf_attr, mt5.TIMEFRAME_H1)
    rates = mt5.copy_rates_range(symbol, tf, dt_from, dt_to)

    if rates is None or len(rates) == 0:
        raise RuntimeError(
            f"MT5: {symbol} のバーデータが取得できませんでした。"
            f"シンボル名・MT5接続・期間を確認してください。(error={mt5.last_error()})"
        )

    df = pd.DataFrame(rates)
    df["datetime"] = pd.to_datetime(df["time"], unit="s")
    df = df.set_index("datetime")
    df = df.rename(columns={"tick_volume": "volume"})[
        ["open", "high", "low", "close", "volume", "spread", "real_volume"]
    ]

    file_id = f"{symbol}_{interval}_{_date_str(dt_from)}_{_date_str(dt_to)}"
    path = BARS_DIR / f"{file_id}.parquet"
    df.to_parquet(path)
    logger.info("Saved bars: %s (%d rows)", path, len(df))
    return file_id


def list_bars() -> list[dict]:
    """保存済みバーデータの一覧をメタデータ付きで返す。"""
    result = []
    for p in sorted(BARS_DIR.glob("*.parquet")):
        file_id = p.stem
        parts = file_id.split("_")
        meta = {
            "file_id": file_id,
            "symbol": parts[0] if len(parts) > 0 else "",
            "interval": parts[1] if len(parts) > 1 else "",
            "date_from": parts[2] if len(parts) > 2 else "",
            "date_to": parts[3] if len(parts) > 3 else "",
            "size_bytes": p.stat().st_size,
            "rows": None,
        }
        try:
            meta["rows"] = len(pd.read_parquet(p, columns=["open"]))
        except Exception:
            pass
        result.append(meta)
    return result


def get_bars_preview(file_id: str, limit: int = 500) -> list[dict]:
    """先頭 limit 件を dict リストで返す。"""
    path = BARS_DIR / f"{file_id}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"bars file not found: {file_id}")
    df = pd.read_parquet(path).head(limit).reset_index()
    df["datetime"] = df["datetime"].astype(str)
    return df.to_dict(orient="records")


def delete_bars(file_id: str) -> None:
    """parquet ファイルを削除する。"""
    path = BARS_DIR / f"{file_id}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"bars file not found: {file_id}")
    path.unlink()
    logger.info("Deleted bars: %s", path)


# ── ティックデータ ───────────────────────────────────────────

def fetch_and_save_ticks(symbol: str, date_from: str, date_to: str) -> str:
    """MT5 copy_ticks_range でティックデータを取得し parquet 保存。file_id を返す。"""
    import metatrader5 as mt5

    dt_from = _parse_date(date_from)
    dt_to   = _parse_date(date_to)

    if not mt5.initialize():
        raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")

    ticks = mt5.copy_ticks_range(symbol, dt_from, dt_to, mt5.COPY_TICKS_ALL)

    if ticks is None or len(ticks) == 0:
        raise RuntimeError(
            f"MT5: {symbol} のティックデータが取得できませんでした。"
            f"シンボル名・MT5接続・期間を確認してください。(error={mt5.last_error()})"
        )

    df = pd.DataFrame(ticks)
    df["datetime"] = pd.to_datetime(df["time"], unit="s")
    df = df.set_index("datetime")

    file_id = f"{symbol}_{_date_str(dt_from)}_{_date_str(dt_to)}"
    path = TICKS_DIR / f"{file_id}.parquet"
    df.to_parquet(path)
    logger.info("Saved ticks: %s (%d rows)", path, len(df))
    return file_id


def list_ticks() -> list[dict]:
    """保存済みティックデータの一覧をメタデータ付きで返す。"""
    result = []
    for p in sorted(TICKS_DIR.glob("*.parquet")):
        file_id = p.stem
        parts = file_id.split("_")
        meta = {
            "file_id": file_id,
            "symbol": parts[0] if len(parts) > 0 else "",
            "date_from": parts[1] if len(parts) > 1 else "",
            "date_to": parts[2] if len(parts) > 2 else "",
            "size_bytes": p.stat().st_size,
            "rows": None,
        }
        try:
            meta["rows"] = len(pd.read_parquet(p, columns=["bid"]))
        except Exception:
            pass
        result.append(meta)
    return result


def get_ticks_preview(file_id: str, limit: int = 1000) -> list[dict]:
    """先頭 limit 件を dict リストで返す。"""
    path = TICKS_DIR / f"{file_id}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"ticks file not found: {file_id}")
    df = pd.read_parquet(path).head(limit).reset_index()
    df["datetime"] = df["datetime"].astype(str)
    return df.to_dict(orient="records")


def delete_ticks(file_id: str) -> None:
    """parquet ファイルを削除する。"""
    path = TICKS_DIR / f"{file_id}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"ticks file not found: {file_id}")
    path.unlink()
    logger.info("Deleted ticks: %s", path)
