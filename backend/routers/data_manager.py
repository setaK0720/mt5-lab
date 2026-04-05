"""MT5データ管理 APIルーター"""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/data", tags=["data"])


class FetchBarsRequest(BaseModel):
    symbol: str
    interval: str
    date_from: str  # YYYY-MM-DD
    date_to: str    # YYYY-MM-DD


class FetchTicksRequest(BaseModel):
    symbol: str
    date_from: str  # YYYY-MM-DD
    date_to: str    # YYYY-MM-DD


# ── シンボル一覧 ─────────────────────────────────────────────

@router.get("/symbols")
async def list_symbols():
    """MT5ログイン口座で取引可能なシンボル一覧を返す。"""
    try:
        import metatrader5 as mt5
        if not mt5.initialize():
            raise RuntimeError(f"MT5 initialize failed: {mt5.last_error()}")
        symbols = mt5.symbols_get()
        if symbols is None:
            raise RuntimeError(f"MT5 symbols_get failed: {mt5.last_error()}")
        return sorted([s.name for s in symbols])
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── バーデータ ───────────────────────────────────────────────

@router.post("/bars/fetch")
async def fetch_bars(req: FetchBarsRequest):
    """MT5からバーデータを取得して保存する。"""
    from services.mt5_data_store import fetch_and_save_bars
    try:
        file_id = fetch_and_save_bars(req.symbol, req.interval, req.date_from, req.date_to)
        return {"file_id": file_id, "status": "saved"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/bars")
async def list_bars():
    """保存済みバーデータの一覧を返す。"""
    from services.mt5_data_store import list_bars as _list
    return _list()


@router.get("/bars/{file_id}/preview")
async def get_bars_preview(file_id: str, limit: int = 500):
    """バーデータの先頭 limit 件を返す。"""
    from services.mt5_data_store import get_bars_preview
    try:
        return {"file_id": file_id, "data": get_bars_preview(file_id, limit)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/bars/{file_id}", status_code=204)
async def delete_bars(file_id: str):
    """バーデータファイルを削除する。"""
    from services.mt5_data_store import delete_bars as _delete
    try:
        _delete(file_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── ティックデータ ───────────────────────────────────────────

@router.post("/ticks/fetch")
async def fetch_ticks(req: FetchTicksRequest):
    """MT5からティックデータを取得して保存する。"""
    from services.mt5_data_store import fetch_and_save_ticks
    try:
        file_id = fetch_and_save_ticks(req.symbol, req.date_from, req.date_to)
        return {"file_id": file_id, "status": "saved"}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/ticks")
async def list_ticks():
    """保存済みティックデータの一覧を返す。"""
    from services.mt5_data_store import list_ticks as _list
    return _list()


@router.get("/ticks/{file_id}/preview")
async def get_ticks_preview(file_id: str, limit: int = 1000):
    """ティックデータの先頭 limit 件を返す。"""
    from services.mt5_data_store import get_ticks_preview
    try:
        return {"file_id": file_id, "data": get_ticks_preview(file_id, limit)}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/ticks/{file_id}", status_code=204)
async def delete_ticks(file_id: str):
    """ティックデータファイルを削除する。"""
    from services.mt5_data_store import delete_ticks as _delete
    try:
        _delete(file_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
