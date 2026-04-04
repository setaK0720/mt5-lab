"""vectorbt バックテストエンジン + 非同期ジョブ管理"""
import asyncio
import logging
import math
import uuid
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import pandas as pd

logger = logging.getLogger(__name__)

# ジョブストア: job_id → { status, result, error }
job_store: dict[str, dict[str, Any]] = {}


def _run_backtest(
    df: "Any",
    signals: "Any",
    init_cash: float = 10000.0,
    fees: float = 0.0002,
) -> dict[str, Any]:
    """vectorbt でバックテストを実行し結果を返す。"""
    try:
        import vectorbt as vbt  # type: ignore

        close = df["close"]
        entries = signals == 1
        exits = signals == -1

        pf = vbt.Portfolio.from_signals(
            close,
            entries=entries,
            exits=exits,
            init_cash=init_cash,
            fees=fees,
            freq="1H",
        )

        fig = pf.plot()
        plot_json = fig.to_json()

        stats_dict = dict(pf.stats())
        safe_stats: dict[str, Any] = {}
        for k, v in stats_dict.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                safe_stats[str(k)] = None
            else:
                safe_stats[str(k)] = v

        # 取引履歴
        trades = _extract_trades_vectorbt(pf)

        return {"plot_json": plot_json, "stats": safe_stats, "trades": trades}

    except ImportError:
        logger.warning("vectorbt not installed – using simple backtest fallback")
        return _simple_backtest(df, signals, init_cash, fees)
    except Exception as e:
        logger.error("vectorbt backtest error: %s", e)
        raise


def _extract_trades_vectorbt(pf) -> list[dict]:
    """vectorbt Portfolio から取引履歴リストを生成する。"""
    try:
        trades_df = pf.trades.records_readable
        result = []
        for _, row in trades_df.iterrows():
            pnl = float(row.get("P&L", 0))
            ret = float(row.get("Return", 0))
            result.append({
                "id": int(row.get("Trade Id", len(result))),
                "entry_date": str(row.get("Entry Index", "")),
                "entry_price": round(float(row.get("Entry Price", 0)), 5),
                "exit_date": str(row.get("Exit Index", "")),
                "exit_price": round(float(row.get("Exit Price", 0)), 5),
                "size": round(float(row.get("Size", 0)), 4),
                "pnl": round(pnl, 2) if not math.isnan(pnl) else None,
                "return_pct": round(ret * 100, 2) if not math.isnan(ret) else None,
                "direction": str(row.get("Direction", "")),
            })
        return result
    except Exception as e:
        logger.warning("Trade extraction error: %s", e)
        return []


def _simple_backtest(
    df: "Any",
    signals: "Any",
    init_cash: float,
    fees: float,
) -> dict[str, Any]:
    """vectorbt 非インストール時のフォールバック実装。"""
    cash = init_cash
    position = 0.0
    entry_price = 0.0
    entry_date = ""
    equity_curve = []
    trades = []
    trade_id = 1

    for i, (ts, row) in enumerate(df.iterrows()):
        sig = signals.iloc[i] if i < len(signals) else 0
        price = float(row["close"])

        if sig == 1 and position == 0:
            position = (cash * (1 - fees)) / price
            entry_price = price
            entry_date = str(ts)
            cash = 0.0

        elif sig == -1 and position > 0:
            cash = position * price * (1 - fees)
            pnl = round(position * (price - entry_price) * (1 - fees), 2)
            ret = round((price - entry_price) / entry_price * 100, 2)
            trades.append({
                "id": trade_id,
                "entry_date": entry_date,
                "entry_price": round(entry_price, 5),
                "exit_date": str(ts),
                "exit_price": round(price, 5),
                "size": round(position, 4),
                "pnl": pnl,
                "return_pct": ret,
                "direction": "Long",
            })
            trade_id += 1
            position = 0.0

        equity = cash + position * price
        equity_curve.append({"datetime": str(ts), "equity": equity})

    # 未決済ポジションを最終バーで強制クローズ
    if position > 0:
        last_price = float(df["close"].iloc[-1])
        last_date = str(df.index[-1])
        cash = position * last_price * (1 - fees)
        pnl = round(position * (last_price - entry_price) * (1 - fees), 2)
        ret = round((last_price - entry_price) / entry_price * 100, 2)
        trades.append({
            "id": trade_id,
            "entry_date": entry_date,
            "entry_price": round(entry_price, 5),
            "exit_date": last_date + " (未決済)",
            "exit_price": round(last_price, 5),
            "size": round(position, 4),
            "pnl": pnl,
            "return_pct": ret,
            "direction": "Long",
        })

    total_return = (cash - init_cash) / init_cash * 100
    win_trades = [t for t in trades if (t["pnl"] or 0) > 0]
    win_rate = round(len(win_trades) / len(trades) * 100, 1) if trades else 0

    stats = {
        "Total Return [%]": round(total_return, 2),
        "Final Value": round(cash, 2),
        "Total Trades": len(trades),
        "Win Rate [%]": win_rate,
        "Note": "Simplified backtest (vectorbt not installed)",
    }

    import plotly.graph_objects as go
    dates = [r["datetime"] for r in equity_curve]
    equities = [r["equity"] for r in equity_curve]
    fig = go.Figure(go.Scatter(x=dates, y=equities, mode="lines", name="Equity"))
    fig.update_layout(title="Equity Curve", xaxis_title="Date", yaxis_title="Value")
    plot_json = fig.to_json()

    return {"plot_json": plot_json, "stats": stats, "trades": trades}


async def submit_backtest(
    df: "Any",
    signals: "Any",
    init_cash: float = 10000.0,
    fees: float = 0.0002,
) -> str:
    """バックテストジョブを非同期で開始し、ジョブIDを返す。"""
    job_id = str(uuid.uuid4())
    job_store[job_id] = {"status": "running", "result": None, "error": None}

    async def _worker():
        try:
            result = await asyncio.to_thread(
                _run_backtest, df, signals, init_cash, fees
            )
            job_store[job_id]["result"] = result
            job_store[job_id]["status"] = "done"
        except Exception as e:
            job_store[job_id]["error"] = str(e)
            job_store[job_id]["status"] = "error"

    asyncio.create_task(_worker())
    return job_id


def get_job(job_id: str) -> dict[str, Any] | None:
    return job_store.get(job_id)
