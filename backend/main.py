"""MT5 Lab - FastAPIエントリポイント（分析・リサーチ専用, ポート 8001）"""
import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="MT5 Lab")

# APIルーター登録
from routers import analysis, research
app.include_router(analysis.router)
app.include_router(research.router)

# 静的ファイル配信（本番用: bun run build でここに出力）
dist_dir = Path(__file__).parent / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")
