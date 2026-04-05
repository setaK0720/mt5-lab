"""分析・バックテスト APIルーター"""
import importlib.util
import logging
import sys
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/analysis", tags=["analysis"])

_strategies_dir = Path(__file__).parent.parent.parent / "strategies"

# 利用可能なストラテジー（遅延ロード）
_STRATEGIES: dict[str, type] | None = None


def _load_strategy_class(module_path: Path, class_name: str):
    """ファイルパスから直接クラスをロードする。"""
    spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
    if spec is None or spec.loader is None:
        return None
    # base_strategy も同様にロード
    base_path = module_path.parent / "base_strategy.py"
    base_spec = importlib.util.spec_from_file_location("base_strategy", base_path)
    if base_spec and base_spec.loader:
        base_mod = importlib.util.module_from_spec(base_spec)
        sys.modules.setdefault("base_strategy", base_mod)
        base_spec.loader.exec_module(base_mod)  # type: ignore

    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)  # type: ignore
    return getattr(mod, class_name, None)


def _get_strategies() -> dict[str, type]:
    global _STRATEGIES
    if _STRATEGIES is not None:
        return _STRATEGIES
    _STRATEGIES = {}

    try:
        cls = _load_strategy_class(_strategies_dir / "sma_cross.py", "SmaCrossStrategy")
        if cls:
            _STRATEGIES["sma_cross"] = cls
            logger.info("Loaded strategy: sma_cross")
        else:
            logger.warning("SmaCrossStrategy class not found")
    except Exception as e:
        logger.warning("Strategy load error (sma_cross): %s", e)

    try:
        cls = _load_strategy_class(_strategies_dir / "nanpin_strategy.py", "NanpinStrategy")
        if cls:
            _STRATEGIES["nanpin"] = cls
            logger.info("Loaded strategy: nanpin")
        else:
            logger.warning("NanpinStrategy class not found")
    except Exception as e:
        logger.warning("Strategy load error (nanpin): %s", e)

    return _STRATEGIES


def _fetch_ohlcv(symbol, interval, period, source):
    from services.data_fetcher import fetch_ohlcv
    return fetch_ohlcv(symbol, interval, period, source)


def _calc_indicators(df):
    from services.indicator_calc import calculate_indicators
    return calculate_indicators(df)


def _to_records(df):
    from services.indicator_calc import to_json_records
    return to_json_records(df)


@router.get("/ohlcv")
async def get_ohlcv(
    symbol: Annotated[str, Query(description="ティッカーシンボル")] = "EURUSD",
    interval: Annotated[str, Query()] = "1h",
    period: Annotated[str, Query()] = "30d",
    source: Annotated[str, Query()] = "mt5",
):
    """OHLCVデータを返す。"""
    try:
        df = _fetch_ohlcv(symbol, interval, period, source)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
    return {"symbol": symbol, "interval": interval, "data": _to_records(df)}


@router.get("/indicators")
async def get_indicators(
    symbol: Annotated[str, Query()] = "EURUSD",
    interval: Annotated[str, Query()] = "1h",
    period: Annotated[str, Query()] = "30d",
    source: Annotated[str, Query()] = "mt5",
):
    """OHLCVデータ + テクニカル指標を返す。"""
    try:
        df = _fetch_ohlcv(symbol, interval, period, source)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if df.empty:
        raise HTTPException(status_code=404, detail="Data not found")
    df = _calc_indicators(df)
    return {"symbol": symbol, "interval": interval, "data": _to_records(df)}


@router.get("/strategies")
async def list_strategies():
    """利用可能なストラテジー一覧とパラメータスキーマを返す。"""
    strategies = _get_strategies()
    return [
        {
            "key": key,
            "name": getattr(cls, "name", key),
            "params": getattr(cls, "param_schema", {}),
        }
        for key, cls in strategies.items()
    ]


class BacktestRequest(BaseModel):
    strategy: str = "sma_cross"
    symbol: str = "GOLDmicro"
    interval: str = "1h"
    period: str = "1y"
    source: str = "mt5"
    params: dict = {}
    init_cash: float = 10000.0
    fees: float = 0.0002
    date_from: str | None = None  # YYYY-MM-DD
    date_to:   str | None = None  # YYYY-MM-DD


@router.post("/backtest", status_code=202)
async def start_backtest(req: BacktestRequest):
    """バックテストジョブを開始し、ジョブIDを返す。"""
    from services.backtest_engine import submit_simulation

    strategies = _get_strategies()
    if req.strategy not in strategies:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy}")

    try:
        if req.date_from and req.date_to:
            from services.data_fetcher import fetch_ohlcv_range
            df = fetch_ohlcv_range(req.symbol, req.interval, req.date_from, req.date_to)
        else:
            df = _fetch_ohlcv(req.symbol, req.interval, req.period, req.source)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if df.empty:
        raise HTTPException(status_code=404, detail="Price data not found")

    strategy_cls = strategies[req.strategy]
    strategy = strategy_cls(params=req.params)

    tick_df = None
    if req.strategy == "nanpin" and req.params.get("use_tick_lc") == "on":
        if req.date_from and req.date_to:
            try:
                from services.data_fetcher import fetch_tick_range
                tick_df = fetch_tick_range(req.symbol, req.date_from, req.date_to)
                logger.info("tick_df loaded: %d rows", len(tick_df))
            except Exception as e:
                logger.warning("tick fetch failed, LC disabled: %s", e)

    job_id = await submit_simulation(strategy, df, req.init_cash, req.fees, tick_df=tick_df)
    return {"job_id": job_id, "status": "running"}


@router.get("/backtest/{job_id}")
async def get_backtest_result(job_id: str):
    """バックテストジョブの状態・結果を返す。"""
    from services.backtest_engine import get_job
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
