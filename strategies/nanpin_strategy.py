"""ナンピンEA ストラテジー実装"""
import math
import sys
from pathlib import Path
from typing import TYPE_CHECKING, Any

sys.path.insert(0, str(Path(__file__).parent))
from base_strategy import BaseStrategy  # noqa: E402

if TYPE_CHECKING:
    import pandas as pd


class NanpinStrategy(BaseStrategy):
    """ナンピン（追加購入）EA ストラテジー。

    generate_signals() は使用せず、simulate() でステートフルなシミュレーションを行う。
    """

    name = "ナンピンEA"
    param_schema = {
        "direction": {
            "type": "string",
            "default": "long",
            "options": ["long", "short"],
            "label": "売買方向",
        },
        "entry_method": {
            "type": "string",
            "default": "always",
            "options": ["always", "ma_cross"],
            "label": "エントリー条件",
        },
        "ma_fast": {
            "type": "int",
            "default": 20,
            "min": 5,
            "max": 200,
            "label": "短期MA期間 (ma_cross時のみ)",
        },
        "ma_slow": {
            "type": "int",
            "default": 50,
            "min": 10,
            "max": 500,
            "label": "長期MA期間 (ma_cross時のみ)",
        },
        "initial_units": {
            "type": "float",
            "default": 1.0,
            "min": 0.01,
            "max": 100.0,
            "step": 0.01,
            "label": "初回ロット数 (1lot=10万通貨)",
        },
        "lot_multiplier": {
            "type": "float",
            "default": 1.0,
            "min": 0.5,
            "max": 5.0,
            "step": 0.1,
            "label": "ロット倍率 (1.0=固定, 2.0=マーチンゲール)",
        },
        "nanpin_step_pct": {
            "type": "float",
            "default": 1.0,
            "min": 0.1,
            "max": 20.0,
            "step": 0.1,
            "label": "ナンピン幅 (%)",
        },
        "max_nanpin": {
            "type": "int",
            "default": 4,
            "min": 1,
            "max": 20,
            "label": "最大ナンピン回数",
        },
        "pip_size": {
            "type": "float",
            "default": 0.1,
            "min": 0.0001,
            "max": 10.0,
            "step": 0.0001,
            "label": "1pip のサイズ (GOLDmicro=0.1, FX=0.0001)",
        },
        "take_profit_pips": {
            "type": "float",
            "default": 100.0,
            "min": 1.0,
            "max": 10000.0,
            "step": 1.0,
            "label": "利確幅 (pips)",
        },
        "stop_loss_pct": {
            "type": "float",
            "default": 0.0,
            "min": 0.0,
            "max": 100.0,
            "step": 0.1,
            "label": "損切り幅 (% / 0=なし)",
        },
        "leverage": {
            "type": "int",
            "default": 1000,
            "min": 1,
            "max": 1000,
            "label": "レバレッジ (倍)",
        },
        "spread_pips": {
            "type": "float",
            "default": 0.0,
            "min": 0.0,
            "max": 100.0,
            "step": 0.1,
            "label": "スプレッド (pips)",
        },
        "use_tick_lc": {
            "type": "string",
            "default": "off",
            "options": ["off", "on"],
            "label": "ティックベースロスカット",
        },
    }

    def generate_signals(self, df: "pd.DataFrame") -> "pd.Series":
        """NanpinStrategy は simulate() を使うため、ダミーを返す。"""
        import pandas as pd
        return pd.Series(0, index=df.index, dtype=int)

    def simulate(
        self,
        df: "pd.DataFrame",
        init_cash: float = 10000.0,
        fees: float = 0.0002,
        tick_df: "pd.DataFrame | None" = None,
    ) -> dict[str, Any]:
        """ナンピンEAシミュレーションを実行する。

        Args:
            df: OHLCV DataFrame（index=datetime, columns=[open,high,low,close,volume]）
            init_cash: 初期資金
            fees: 取引手数料率

        Returns:
            dict: {plot_json, stats, trades}（backtest_engine._run_backtest と同形式）
        """
        import pandas as pd

        # パラメータ取得
        direction: str = str(self.params.get("direction", "long"))
        entry_method: str = str(self.params.get("entry_method", "always"))
        ma_fast: int = int(self.params.get("ma_fast", 20))
        ma_slow: int = int(self.params.get("ma_slow", 50))
        initial_units: float = float(self.params.get("initial_units", 1.0))
        lot_multiplier: float = float(self.params.get("lot_multiplier", 1.0))
        nanpin_step_pct: float = float(self.params.get("nanpin_step_pct", 1.0))
        max_nanpin: int = int(self.params.get("max_nanpin", 4))
        pip_size: float = float(self.params.get("pip_size", 0.1))
        take_profit_pips: float = float(self.params.get("take_profit_pips", 100.0))
        stop_loss_pct: float = float(self.params.get("stop_loss_pct", 0.0))
        leverage: int = max(1, int(self.params.get("leverage", 1)))
        spread_pips: float = float(self.params.get("spread_pips", 0.0))
        spread_price: float = spread_pips * pip_size  # スプレッドを価格単位に変換
        use_tick_lc: bool = str(self.params.get("use_tick_lc", "off")) == "on"
        lot_size: int = 100_000  # 1ロット = 10万通貨（海外FX標準）

        # MA シグナル事前計算（ma_cross 用）
        close_series = df["close"]
        ma_entry_signal: pd.Series | None = None
        if entry_method == "ma_cross":
            sma_fast = close_series.rolling(ma_fast).mean()
            sma_slow = close_series.rolling(ma_slow).mean()
            if direction == "long":
                # 短期が長期を上抜いた後の最初のバー
                cross = (sma_fast > sma_slow) & (sma_fast.shift(1) <= sma_slow.shift(1))
            else:
                cross = (sma_fast < sma_slow) & (sma_fast.shift(1) >= sma_slow.shift(1))
            # クロス後フラグを持続させる（次のクロスまで）
            ma_entry_signal = cross

        # 方向係数（long=+1, short=-1）
        dir_sign = 1.0 if direction == "long" else -1.0

        # シミュレーション変数
        cash = init_cash
        # positions: list of {"price": float, "units": float}
        positions: list[dict] = []
        equity_curve: list[dict] = []
        trades: list[dict] = []
        positions_log: list[dict] = []  # 全エントリー（ナンピン含む）の個別記録
        trade_id = 1
        pos_log_id = 1
        nanpin_counts: list[int] = []
        lc_triggered = False
        lc_datetime: str = ""

        # ma_cross 用: 現在エントリー許可中かどうか
        ma_allow_entry = False

        n = len(df)
        for i in range(n):
            ts = df.index[i]
            price = float(df["close"].iloc[i])
            # エントリー価格: ロングはask（close + spread）、ショートはbid（close）
            entry_price_with_spread = price + spread_price if direction == "long" else price

            # MAクロス状態更新
            if entry_method == "ma_cross" and ma_entry_signal is not None:
                if bool(ma_entry_signal.iloc[i]):
                    ma_allow_entry = True

            # ---- ポジションあり: TP / SL / ナンピン判定 ----
            if positions:
                total_units = sum(p["units"] for p in positions)
                avg_price = sum(p["price"] * p["units"] for p in positions) / total_units

                profit_pct = (price - avg_price) / avg_price * dir_sign * 100.0
                profit_pips = (price - avg_price) * dir_sign / pip_size

                closed = False

                # 利確（平均取得単価からの pips 利益で判定）
                if profit_pips >= take_profit_pips:
                    revenue = total_units * lot_size * price * (1 - fees)
                    cost = sum(p["units"] * lot_size * p["price"] * (1 + fees) for p in positions)
                    total_margin = sum(p["margin"] for p in positions)
                    pnl = round(revenue - cost, 2)
                    ret_pct = round(pnl / total_margin * 100, 2) if total_margin else 0.0
                    entry_price_repr = round(avg_price, 5)
                    first_entry_date = str(positions[0].get("entry_date", ts))
                    nanpin_count = len(positions) - 1
                    trades.append({
                        "id": trade_id,
                        "entry_date": first_entry_date,
                        "entry_price": entry_price_repr,
                        "exit_date": str(ts),
                        "exit_price": round(price, 5),
                        "size": round(total_units, 4),
                        "pnl": pnl,
                        "return_pct": ret_pct,
                        "direction": "Long" if direction == "long" else "Short",
                        "nanpin_count": nanpin_count,
                    })
                    nanpin_counts.append(nanpin_count)
                    cash += total_margin + pnl
                    positions = []
                    ma_allow_entry = False
                    trade_id += 1
                    closed = True

                # 損切り
                elif stop_loss_pct > 0 and -profit_pct >= stop_loss_pct:
                    revenue = total_units * lot_size * price * (1 - fees)
                    cost = sum(p["units"] * lot_size * p["price"] * (1 + fees) for p in positions)
                    total_margin = sum(p["margin"] for p in positions)
                    pnl = round(revenue - cost, 2)
                    ret_pct = round(pnl / total_margin * 100, 2) if total_margin else 0.0
                    entry_price_repr = round(avg_price, 5)
                    first_entry_date = str(positions[0].get("entry_date", ts))
                    nanpin_count = len(positions) - 1
                    trades.append({
                        "id": trade_id,
                        "entry_date": first_entry_date,
                        "entry_price": entry_price_repr,
                        "exit_date": str(ts),
                        "exit_price": round(price, 5),
                        "size": round(total_units, 4),
                        "pnl": pnl,
                        "return_pct": ret_pct,
                        "direction": "Long" if direction == "long" else "Short",
                        "nanpin_count": nanpin_count,
                    })
                    nanpin_counts.append(nanpin_count)
                    cash += total_margin + pnl
                    positions = []
                    ma_allow_entry = False
                    trade_id += 1
                    closed = True

                # ナンピン
                if not closed and len(positions) <= max_nanpin:
                    last_price = positions[-1]["price"]
                    deviation_pct = (last_price - price) / last_price * dir_sign * 100.0
                    if deviation_pct >= nanpin_step_pct:
                        next_units = initial_units * (lot_multiplier ** len(positions))
                        margin = next_units * lot_size * entry_price_with_spread * (1 + fees) / leverage
                        if cash >= margin:
                            cash -= margin
                            pos_entry = {
                                "price": entry_price_with_spread,
                                "units": next_units,
                                "margin": margin,
                                "entry_date": str(ts),
                            }
                            positions.append(pos_entry)
                            positions_log.append({
                                "id": pos_log_id,
                                "trade_id": trade_id,
                                "type": f"ナンピン{len(positions) - 1}",
                                "direction": "Long" if direction == "long" else "Short",
                                "entry_date": str(ts),
                                "entry_price": round(entry_price_with_spread, 5),
                                "size": round(next_units, 4),
                                "margin": round(margin, 2),
                            })
                            pos_log_id += 1

                # ---- ティックベースロスカット判定 ----
                if not closed and positions and use_tick_lc and tick_df is not None:
                    bar_start = ts
                    bar_end = df.index[i + 1] if i + 1 < n else None
                    bar_ticks = (
                        tick_df[bar_start:bar_end]
                        if bar_end is not None
                        else tick_df[bar_start:]
                    )
                    for tick_ts, tick in bar_ticks.iterrows():
                        tick_price = float(tick["bid"] if direction == "long" else tick["ask"])
                        unrealized_tick = sum(
                            (tick_price - p["price"]) * p["units"] * lot_size * dir_sign
                            for p in positions
                        )
                        locked_margin = sum(p["margin"] for p in positions)
                        equity_tick = cash + locked_margin + unrealized_tick
                        if equity_tick <= 0:
                            # ロスカット発動: 全ポジション強制決済
                            total_units = sum(p["units"] for p in positions)
                            avg_price = sum(p["price"] * p["units"] for p in positions) / total_units
                            revenue = total_units * lot_size * tick_price * (1 - fees)
                            cost = sum(p["units"] * lot_size * p["price"] * (1 + fees) for p in positions)
                            total_margin = locked_margin
                            pnl = round(revenue - cost, 2)
                            ret_pct = round(pnl / total_margin * 100, 2) if total_margin else 0.0
                            nanpin_count = len(positions) - 1
                            trades.append({
                                "id": trade_id,
                                "entry_date": str(positions[0].get("entry_date", ts)),
                                "entry_price": round(avg_price, 5),
                                "exit_date": str(tick_ts) + " (LC)",
                                "exit_price": round(tick_price, 5),
                                "size": round(total_units, 4),
                                "pnl": pnl,
                                "return_pct": ret_pct,
                                "direction": "Long" if direction == "long" else "Short",
                                "nanpin_count": nanpin_count,
                            })
                            nanpin_counts.append(nanpin_count)
                            cash = max(0.0, equity_tick)
                            positions = []
                            lc_triggered = True
                            lc_datetime = str(tick_ts)
                            break

                    if lc_triggered:
                        # エクイティ記録してループ終了
                        equity_curve.append({"datetime": str(ts), "equity": cash})
                        break

            # ---- ポジションなし: エントリー判定 ----
            else:
                can_entry = (
                    entry_method == "always"
                    or (entry_method == "ma_cross" and ma_allow_entry)
                )
                if can_entry:
                    margin = initial_units * lot_size * entry_price_with_spread * (1 + fees) / leverage
                    if cash >= margin:
                        cash -= margin
                        positions.append({
                            "price": entry_price_with_spread,
                            "units": initial_units,
                            "margin": margin,
                            "entry_date": str(ts),
                        })
                        positions_log.append({
                            "id": pos_log_id,
                            "trade_id": trade_id,
                            "type": "初回エントリー",
                            "direction": "Long" if direction == "long" else "Short",
                            "entry_date": str(ts),
                            "entry_price": round(entry_price_with_spread, 5),
                            "size": round(initial_units, 4),
                            "margin": round(margin, 2),
                        })
                        pos_log_id += 1
                        if entry_method == "ma_cross":
                            ma_allow_entry = False

            if lc_triggered:
                break

            # エクイティ計算（証拠金 + 未実現損益 + 空きキャッシュ）
            locked_margin = sum(p["margin"] for p in positions)
            unrealized = sum((price - p["price"]) * p["units"] * lot_size for p in positions)
            equity = cash + locked_margin + unrealized
            equity_curve.append({"datetime": str(ts), "equity": equity})

        # 最終バー: 未決済を強制クローズ（ロスカット発動時はスキップ）
        if positions and not lc_triggered:
            last_price = float(df["close"].iloc[-1])
            last_date = str(df.index[-1])
            total_units = sum(p["units"] for p in positions)
            avg_price = sum(p["price"] * p["units"] for p in positions) / total_units
            revenue = total_units * lot_size * last_price * (1 - fees)
            cost = sum(p["units"] * lot_size * p["price"] * (1 + fees) for p in positions)
            total_margin = sum(p["margin"] for p in positions)
            pnl = round(revenue - cost, 2)
            ret_pct = round(pnl / total_margin * 100, 2) if total_margin else 0.0
            nanpin_count = len(positions) - 1
            trades.append({
                "id": trade_id,
                "entry_date": str(positions[0].get("entry_date", last_date)),
                "entry_price": round(avg_price, 5),
                "exit_date": last_date + " (未決済)",
                "exit_price": round(last_price, 5),
                "size": round(total_units, 4),
                "pnl": pnl,
                "return_pct": ret_pct,
                "direction": "Long" if direction == "long" else "Short",
                "nanpin_count": nanpin_count,
            })
            nanpin_counts.append(nanpin_count)
            cash += total_margin + pnl

        # 統計計算
        final_cash = round(cash, 2)
        total_return = round((cash - init_cash) / init_cash * 100, 2)
        win_trades = [t for t in trades if (t["pnl"] or 0) > 0]
        win_rate = round(len(win_trades) / len(trades) * 100, 1) if trades else 0.0

        # ドローダウン計算
        equities = [r["equity"] for r in equity_curve]
        max_dd = 0.0
        peak = equities[0] if equities else init_cash
        for eq in equities:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100 if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd

        avg_nanpin = round(sum(nanpin_counts) / len(nanpin_counts), 2) if nanpin_counts else 0.0
        max_nanpin_count = max(nanpin_counts) if nanpin_counts else 0

        stats: dict[str, Any] = {
            "Total Trades": len(trades),
            "Win Rate [%]": win_rate,
            "Total Return [%]": total_return,
            "Max Drawdown [%]": round(max_dd, 2),
            "Avg Nanpin Count": avg_nanpin,
            "Max Nanpin Count": max_nanpin_count,
            "Final Cash": final_cash,
            "Margin Call": f"Yes ({lc_datetime})" if lc_triggered else "No",
        }

        # Plotly エクイティカーブ
        import plotly.graph_objects as go

        dates = [r["datetime"] for r in equity_curve]
        eq_values = [r["equity"] for r in equity_curve]
        fig = go.Figure(go.Scatter(x=dates, y=eq_values, mode="lines", name="Equity"))
        fig.update_layout(
            title=f"ナンピンEA Equity Curve ({direction})",
            xaxis_title="Date",
            yaxis_title="Value",
        )
        plot_json = fig.to_json()

        return {"plot_json": plot_json, "stats": stats, "trades": trades, "positions_log": positions_log}
