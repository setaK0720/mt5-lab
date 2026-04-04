"""テクニカル指標計算 – 純 pandas 実装（外部ライブラリ不要）"""
import logging
import math

logger = logging.getLogger(__name__)


def calculate_indicators(df):
    """OHLCVデータに主要テクニカル指標を追加して返す。

    追加カラム:
        ema_20, ema_50, rsi_14,
        macd, macd_signal, macd_hist,
        bb_upper, bb_mid, bb_lower
    """
    if df.empty:
        return df

    out = df.copy()
    close = out["close"]

    # EMA
    out["ema_20"] = close.ewm(span=20, adjust=False).mean()
    out["ema_50"] = close.ewm(span=50, adjust=False).mean()

    # RSI(14)
    out["rsi_14"] = _rsi(close, 14)

    # MACD(12,26,9)
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    out["macd"] = macd_line
    out["macd_signal"] = signal_line
    out["macd_hist"] = macd_line - signal_line

    # Bollinger Bands(20, 2σ)
    rolling = close.rolling(20)
    bb_mid = rolling.mean()
    bb_std = rolling.std(ddof=0)
    out["bb_mid"] = bb_mid
    out["bb_upper"] = bb_mid + 2 * bb_std
    out["bb_lower"] = bb_mid - 2 * bb_std

    return out


def _rsi(series, period: int = 14):
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def to_json_records(df) -> list[dict]:
    """DataFrame を JSON シリアライズ可能なリストに変換する。"""
    import pandas as pd

    df_reset = df.reset_index()
    if "datetime" in df_reset.columns:
        df_reset["datetime"] = df_reset["datetime"].astype(str)

    records = df_reset.to_dict(orient="records")
    clean = []
    for row in records:
        clean_row = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean_row[k] = None
            else:
                clean_row[k] = v
        clean.append(clean_row)
    return clean
