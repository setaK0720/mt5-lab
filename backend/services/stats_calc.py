"""統計分析計算モジュール"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd


def calc_returns(df: pd.DataFrame) -> dict[str, Any]:
    """リターン分布の統計量とヒストグラムビンを計算する。

    Args:
        df: OHLCV DataFrame（close 列必須）

    Returns:
        {
            stats: {count, mean, std, skew, kurt, min, max, p5, p25, p75, p95},
            bins: [float],   # ビン境界値（len = len(counts)+1）
            counts: [int],
        }
    """
    close = df["close"].dropna().astype(float)
    returns = close.pct_change().dropna()

    if len(returns) < 2:
        return {"stats": {}, "bins": [], "counts": []}

    counts_arr, bin_edges = np.histogram(returns.values, bins=50)

    stats: dict[str, Any] = {
        "count": int(len(returns)),
        "mean": _safe(returns.mean()),
        "std": _safe(returns.std()),
        "skew": _safe(float(returns.skew())),
        "kurt": _safe(float(returns.kurtosis())),
        "min": _safe(returns.min()),
        "max": _safe(returns.max()),
        "p5": _safe(returns.quantile(0.05)),
        "p25": _safe(returns.quantile(0.25)),
        "p75": _safe(returns.quantile(0.75)),
        "p95": _safe(returns.quantile(0.95)),
    }

    return {
        "stats": stats,
        "bins": [_safe(v) for v in bin_edges.tolist()],
        "counts": counts_arr.tolist(),
    }


def calc_volatility(
    df: pd.DataFrame,
    atr_period: int = 14,
    vol_window: int = 20,
) -> dict[str, Any]:
    """ATR と実現ボラティリティの時系列を計算する。

    Returns:
        {
            dates: [str],
            atr: [float | None],
            realized_vol: [float | None],
        }
    """
    d = df.copy()
    d = d.sort_index()

    high = d["high"].astype(float)
    low = d["low"].astype(float)
    close = d["close"].astype(float)

    # TR = max(H-L, |H-prev_C|, |L-prev_C|)
    prev_close = close.shift(1)
    tr = pd.concat(
        [
            high - low,
            (high - prev_close).abs(),
            (low - prev_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    atr = tr.ewm(span=atr_period, adjust=False).mean()

    # 実現ボラ: 日次リターンのローリング標準偏差 × sqrt(252)
    returns = close.pct_change()
    realized_vol = returns.rolling(vol_window).std() * math.sqrt(252)

    # インデックスを文字列化
    if hasattr(d.index, "strftime"):
        dates = d.index.strftime("%Y-%m-%dT%H:%M:%S").tolist()
    else:
        dates = [str(v) for v in d.index.tolist()]

    def to_list(s: pd.Series) -> list[float | None]:
        return [None if (v is None or (isinstance(v, float) and math.isnan(v))) else round(v, 8) for v in s.tolist()]

    return {
        "dates": dates,
        "atr": to_list(atr),
        "realized_vol": to_list(realized_vol),
    }


def calc_correlation(dfs: dict[str, pd.DataFrame]) -> dict[str, Any]:
    """複数シンボルの終値相関行列を計算する。

    Args:
        dfs: {symbol: OHLCV DataFrame}

    Returns:
        {symbols: [str], matrix: [[float]]}
    """
    if len(dfs) < 2:
        symbols = list(dfs.keys())
        return {"symbols": symbols, "matrix": [[1.0]]}

    close_series: dict[str, pd.Series] = {}
    for sym, df in dfs.items():
        s = df["close"].astype(float)
        s.name = sym
        close_series[sym] = s

    combined = pd.concat(close_series.values(), axis=1, join="inner")
    corr = combined.corr()

    symbols = list(corr.columns)
    matrix = [
        [_safe(v) for v in row]
        for row in corr.values.tolist()
    ]

    return {"symbols": symbols, "matrix": matrix}


WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"]
MONTH_LABELS   = ["1月", "2月", "3月", "4月", "5月", "6月",
                  "7月", "8月", "9月", "10月", "11月", "12月"]


def calc_candle_by_time(
    df: pd.DataFrame,
    group_by: str = "hour",
    utc_offset: int = 0,
) -> dict[str, Any]:
    """時間帯別の陽線・陰線割合を計算する。

    Args:
        df: OHLCV DataFrame（open / close 列必須、DatetimeIndex 推奨）
        group_by: "hour" | "weekday" | "month"

    Returns:
        {
            group_by: str,
            rows: [
                {
                    label: str,
                    key: int,
                    bullish: int,
                    bearish: int,
                    neutral: int,
                    total: int,
                    bullish_pct: float,
                    bearish_pct: float,
                }
            ]
        }
    """
    from datetime import timedelta as _td

    d = df.copy()

    # インデックスを DatetimeIndex に統一
    if not isinstance(d.index, pd.DatetimeIndex):
        if "datetime" in d.columns:
            d = d.set_index(pd.to_datetime(d["datetime"]))
        else:
            d.index = pd.to_datetime(d.index)

    # UTCオフセット適用（タイムゾーン情報なしの naive datetime に加算）
    if utc_offset != 0:
        d.index = d.index + _td(hours=utc_offset)

    open_  = d["open"].astype(float)
    close_ = d["close"].astype(float)

    bullish = (close_ > open_).astype(int)
    bearish = (close_ < open_).astype(int)
    neutral = (close_ == open_).astype(int)

    if group_by == "hour":
        key_series = d.index.hour
        def label_fn(k: int) -> str:
            return f"{k:02d}:00"
        all_keys = list(range(24))
    elif group_by == "weekday":
        key_series = d.index.weekday
        def label_fn(k: int) -> str:
            return WEEKDAY_LABELS[k] if k < len(WEEKDAY_LABELS) else str(k)
        all_keys = list(range(7))
    elif group_by == "month":
        key_series = d.index.month
        def label_fn(k: int) -> str:
            return MONTH_LABELS[k - 1] if 1 <= k <= 12 else str(k)
        all_keys = list(range(1, 13))
    else:
        raise ValueError(f"Unknown group_by: {group_by}")

    tmp = pd.DataFrame({
        "key":     key_series,
        "bullish": bullish.values,
        "bearish": bearish.values,
        "neutral": neutral.values,
    })
    agg = tmp.groupby("key")[["bullish", "bearish", "neutral"]].sum()

    rows = []
    for k in all_keys:
        if k in agg.index:
            b  = int(agg.loc[k, "bullish"])
            be = int(agg.loc[k, "bearish"])
            ne = int(agg.loc[k, "neutral"])
        else:
            b = be = ne = 0
        total = b + be + ne
        rows.append({
            "label":       label_fn(k),
            "key":         k,
            "bullish":     b,
            "bearish":     be,
            "neutral":     ne,
            "total":       total,
            "bullish_pct": round(b / total * 100, 1) if total > 0 else None,
            "bearish_pct": round(be / total * 100, 1) if total > 0 else None,
        })

    return {"group_by": group_by, "utc_offset": utc_offset, "rows": rows}


def _safe(v: Any) -> float | None:
    """NaN / inf を None に変換する。"""
    if v is None:
        return None
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 8)
    except (TypeError, ValueError):
        return None
