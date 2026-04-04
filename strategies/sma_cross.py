"""SMAクロス ストラテジー実装例"""
import sys
from pathlib import Path
from typing import TYPE_CHECKING

# importlib 経由でロードされる場合も base_strategy を見つけられるようにする
sys.path.insert(0, str(Path(__file__).parent))
from base_strategy import BaseStrategy  # noqa: E402

if TYPE_CHECKING:
    import pandas as pd


class SmaCrossStrategy(BaseStrategy):
    """単純移動平均クロス戦略。

    短期 SMA が長期 SMA を上抜いたら BUY、下抜いたら SELL。
    """

    name = "SMA Cross"
    param_schema = {
        "fast_period": {"type": "int", "default": 20, "min": 5, "max": 100, "label": "短期SMA期間"},
        "slow_period": {"type": "int", "default": 50, "min": 10, "max": 200, "label": "長期SMA期間"},
    }

    def generate_signals(self, df: "pd.DataFrame") -> "pd.Series":
        import pandas as pd

        fast = int(self.params.get("fast_period", 20))
        slow = int(self.params.get("slow_period", 50))

        close = df["close"]
        sma_fast = close.rolling(fast).mean()
        sma_slow = close.rolling(slow).mean()

        signals = pd.Series(0, index=df.index, dtype=int)
        cross_up = (sma_fast > sma_slow) & (sma_fast.shift(1) <= sma_slow.shift(1))
        cross_down = (sma_fast < sma_slow) & (sma_fast.shift(1) >= sma_slow.shift(1))

        signals[cross_up] = 1
        signals[cross_down] = -1
        return signals
