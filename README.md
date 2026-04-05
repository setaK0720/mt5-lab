# MT5 Lab

MT5 Portal から分離した **分析・リサーチ専用アプリ**。
テクニカル分析・バックテスト・経済指標リサーチをブラウザから行えます。
MT5 接続は不要で、yfinance / FRED / NewsAPI のみで動作します。

> **関連リポジトリ**: トレード操作・Bot 管理は [mt5-portal](https://github.com/setaK0720/mt5-portal) (port 8000) を使用してください。

## 機能

- **価格チャート** — yfinance または MT5 からローソク足 + EMA / RSI / MACD / ボリンジャーバンドを表示
- **バックテスト** — SMA クロス等のストラテジーで過去データをシミュレーション、エクイティカーブ・統計サマリー・取引履歴を表示
- **経済指標（FRED）** — 米国主要指標（金利・CPI・GDP・失業率 等）をグラフ表示
- **経済カレンダー** — Forex Factory から今週の経済イベントを取得
- **ニュース** — NewsAPI 経由でキーワード検索

## アーキテクチャ

```
Windows PC / WSL2
┌────────────────────────────────────────────┐
│  FastAPI :8001                             │
│  ├── routers/analysis.py  (yfinance/MT5)  │
│  └── routers/research.py  (FRED/News)     │
│                                            │
│  React (FastAPI が :8001 で静的配信)        │
└────────────────────────────────────────────┘
```

## 動作環境

| 項目 | 要件 |
|------|------|
| OS | Windows 10/11 + WSL2（MT5 は不要） |
| Python | 3.11 以上（Windows 側） |
| bun | WSL2 側にインストール済みであること |

## セットアップ

> **凡例**
> - 🪟 **Windows** — PowerShell / コマンドプロンプト
> - 🐧 **WSL2** — Linux シェル（NixOS）

---

### 1. リポジトリのクローン　🐧 WSL2

```bash
mkdir -p ~/apps
git clone https://github.com/setaK0720/mt5-lab.git ~/apps/mt5-lab
```

### 2. 環境変数の設定　🐧 WSL2

```bash
cp ~/apps/mt5-lab/backend/.env.example ~/apps/mt5-lab/backend/.env
```

`backend/.env` を開いて API キーを設定します。

```env
FRED_API_KEY=your_fred_api_key_here   # https://fred.stlouisfed.org/docs/api/api_key.html
NEWS_API_KEY=your_news_api_key_here   # https://newsapi.org/
```

> キーなしでも起動できます。FRED / ニュース機能のみ制限されます。

### 3. 本番用フロントエンドビルド　🐧 WSL2

```bash
cd ~/apps/mt5-lab/frontend
bun install
bun run build    # ../backend/dist/ に出力される
```

### 4. バックエンド起動　🪟 Windows

エクスプローラーから `start_lab.bat` をダブルクリックします。

```
\\wsl$\NixOS\home\nixos\apps\mt5-lab\start_lab.bat
```

初回は自動で Python 仮想環境を作成し、依存パッケージをインストールします。

ブラウザで `http://localhost:8001` を開くと Web UI が表示されます。

---

## 開発モード（ホットリロード）

### バックエンド　🪟 Windows

```bat
pushd \\wsl$\NixOS\home\nixos\apps\mt5-lab\backend
call .venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### フロントエンド　🐧 WSL2

**手順 1**: Windows 側の IP を確認します。

```bash
ip route show default | awk '{print $3}'
# 例: 172.25.64.1
```

**手順 2**: `frontend/vite.config.ts` の `WINDOWS_IP` をその値に書き換えます。

```ts
const WINDOWS_IP = "172.25.64.1";  // ← 確認した IP に変更
```

**手順 3**: 開発サーバーを起動します。

```bash
cd ~/apps/mt5-lab/frontend
bun run dev
# http://localhost:5173 でアクセス
```

---

## ディレクトリ構成

```
mt5-lab/
├── backend/
│   ├── main.py              # FastAPI エントリポイント（port 8001）
│   ├── requirements.txt
│   ├── .env                 # API キー（git 管理外）
│   ├── .env.example
│   ├── routers/
│   │   ├── analysis.py      # チャート・バックテスト API
│   │   └── research.py      # FRED・カレンダー・ニュース API
│   └── services/
│       ├── data_fetcher.py  # yfinance / MT5 OHLCV 取得
│       ├── indicator_calc.py
│       ├── backtest_engine.py
│       └── fred_client.py
├── strategies/
│   ├── base_strategy.py     # ストラテジー基底クラス
│   └── sma_cross.py         # SMA クロス実装例
├── frontend/                # React + TypeScript (Vite)
├── start_lab.bat            # Windows 起動スクリプト
└── .gitignore
```

## API エンドポイント

### Analysis

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/analysis/ohlcv` | OHLCV データ取得 |
| GET | `/api/analysis/indicators` | OHLCV + テクニカル指標 |
| GET | `/api/analysis/strategies` | 利用可能なストラテジー一覧 |
| POST | `/api/analysis/backtest` | バックテスト開始（非同期） |
| GET | `/api/analysis/backtest/{job_id}` | バックテスト結果取得 |

### Research

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/research/fred/series` | FRED 人気シリーズ一覧 |
| GET | `/api/research/fred` | FRED 経済指標データ |
| GET | `/api/research/calendar` | 経済カレンダー（Forex Factory） |
| GET | `/api/research/news` | ニュース検索（NewsAPI） |

---

## ストラテジーの追加方法

1. `strategies/base_strategy.py` の `BaseStrategy` を継承した新クラスを作成します。

```python
# strategies/my_strategy.py
from base_strategy import BaseStrategy

class MyStrategy(BaseStrategy):
    name = "My Strategy"
    param_schema = {
        "period": {"type": "int", "default": 20, "min": 5, "max": 200, "label": "期間"},
    }

    def generate_signals(self, df):
        # 1=BUY, -1=SELL, 0=HOLD を返す pd.Series
        ...
```

2. `backend/routers/analysis.py` の `_get_strategies()` に登録します。

```python
cls = _load_strategy_class(_strategies_dir / "my_strategy.py", "MyStrategy")
if cls:
    _STRATEGIES["my_strategy"] = cls
```

3. バックエンドを再起動すると Web UI のバックテストフォームに表示されます。
