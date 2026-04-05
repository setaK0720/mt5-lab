"""統計分析 API ルーター"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.data_fetcher import fetch_ohlcv
from services.stats_calc import calc_candle_by_time, calc_correlation, calc_returns, calc_volatility

router = APIRouter(prefix="/api/stats", tags=["stats"])

BARS_DIR = Path(__file__).parent.parent / "data" / "bars"


# ---------------------------------------------------------------------------
# 共通モデル
# ---------------------------------------------------------------------------

class DataSource(BaseModel):
    source: str = "file"          # "file" | "mt5"
    file_id: str | None = None    # source="file" 時
    symbol: str | None = None     # source="mt5" 時
    interval: str | None = None
    period: str | None = None


class ReturnsRequest(DataSource):
    pass


class VolatilityRequest(DataSource):
    atr_period: int = 14
    vol_window: int = 20


class CorrelationRequest(BaseModel):
    sources: list[DataSource]


class CandleTimeRequest(DataSource):
    group_by: str = "hour"    # "hour" | "weekday" | "month"
    utc_offset: int = 0       # UTC+N（例: +3 ならブローカー時間がUTC+3）


# ---------------------------------------------------------------------------
# ヘルパー
# ---------------------------------------------------------------------------

def _load_df(src: DataSource) -> pd.DataFrame:
    if src.source == "file":
        if not src.file_id:
            raise HTTPException(status_code=400, detail="file_id is required for source='file'")
        path = BARS_DIR / f"{src.file_id}.parquet"
        if not path.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {src.file_id}")
        df = pd.read_parquet(path)
        # インデックスをdatetimeにする
        if "datetime" in df.columns:
            df = df.set_index("datetime")
        return df

    elif src.source == "mt5":
        if not src.symbol:
            raise HTTPException(status_code=400, detail="symbol is required for source='mt5'")
        df = fetch_ohlcv(
            symbol=src.symbol,
            interval=src.interval or "1h",
            period=src.period or "90d",
            source="mt5",
        )
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail=f"No data for {src.symbol}")
        return df

    else:
        raise HTTPException(status_code=400, detail=f"Unknown source: {src.source}")


def _label(src: DataSource) -> str:
    if src.source == "file":
        return src.file_id or "file"
    return src.symbol or "mt5"


# ---------------------------------------------------------------------------
# エンドポイント
# ---------------------------------------------------------------------------

@router.post("/returns")
async def returns_endpoint(req: ReturnsRequest) -> dict[str, Any]:
    df = _load_df(req)
    return calc_returns(df)


@router.post("/volatility")
async def volatility_endpoint(req: VolatilityRequest) -> dict[str, Any]:
    df = _load_df(req)
    return calc_volatility(df, atr_period=req.atr_period, vol_window=req.vol_window)


@router.post("/correlation")
async def correlation_endpoint(req: CorrelationRequest) -> dict[str, Any]:
    if len(req.sources) < 1:
        raise HTTPException(status_code=400, detail="At least 1 source required")
    dfs = {_label(src): _load_df(src) for src in req.sources}
    return calc_correlation(dfs)


@router.post("/candle_time")
async def candle_time_endpoint(req: CandleTimeRequest) -> dict[str, Any]:
    if req.group_by not in ("hour", "weekday", "month"):
        raise HTTPException(status_code=400, detail="group_by must be 'hour', 'weekday', or 'month'")
    df = _load_df(req)
    return calc_candle_by_time(df, group_by=req.group_by, utc_offset=req.utc_offset)
