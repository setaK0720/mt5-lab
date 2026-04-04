"""MT5非依存のストラテジー抽象基底クラス"""
from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd


class BaseStrategy(ABC):
    """バックテストと本番ボット両方から使えるストラテジー基底クラス。

    サブクラスは `generate_signals` を実装すること。
    """

    #: ストラテジー名（UI表示用）
    name: str = "base"
    #: パラメータ定義（UI でフォームを自動生成するために使用）
    param_schema: dict = {}

    def __init__(self, params: dict | None = None):
        self.params = params or {}

    @abstractmethod
    def generate_signals(self, df: "pd.DataFrame") -> "pd.Series":
        """シグナルSeries を返す。

        Args:
            df: OHLCV DataFrame（index=datetime, columns=[open,high,low,close,volume]）

        Returns:
            pd.Series: 1=BUY, -1=SELL, 0=HOLD。index は df と同じ。
        """

    @classmethod
    def get_param_schema(cls) -> dict:
        """パラメータスキーマを返す（フロントエンドのフォーム自動生成用）。"""
        return getattr(cls, "param_schema", {})
