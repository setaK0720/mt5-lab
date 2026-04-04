import { useEffect, useState } from "react";
import { listStrategies, startBacktest } from "../api";
import type { StrategyInfo } from "../types";

interface Props {
  onJobStarted: (jobId: string) => void;
}

const MT5_SYMBOLS = ["EURUSD", "USDJPY", "GBPUSD", "AUDUSD", "USDCHF", "EURJPY", "GBPJPY"];
const YF_SYMBOLS  = ["EURUSD=X", "USDJPY=X", "GBPUSD=X", "AUDUSD=X", "USDCHF=X"];
const PERIODS     = ["90d", "1y", "2y", "5y"];

// MT5 は制限なし / yfinance は period に応じて制限
const MT5_INTERVALS = [
  { value: "15m", label: "15分" },
  { value: "30m", label: "30分" },
  { value: "1h",  label: "1時間" },
  { value: "4h",  label: "4時間" },
  { value: "1d",  label: "日足" },
  { value: "1wk", label: "週足" },
];
const YF_INTERVAL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  "90d": [
    { value: "15m", label: "15分" }, { value: "30m", label: "30分" },
    { value: "1h",  label: "1時間" }, { value: "1d",  label: "日足" },
  ],
  "1y":  [{ value: "1h", label: "1時間" }, { value: "1d", label: "日足" }],
  "2y":  [{ value: "1h", label: "1時間" }, { value: "1d", label: "日足" }, { value: "1wk", label: "週足" }],
  "5y":  [{ value: "1d", label: "日足" }, { value: "1wk", label: "週足" }],
};

function getIntervalOptions(source: string, period: string) {
  return source === "mt5" ? MT5_INTERVALS : (YF_INTERVAL_OPTIONS[period] ?? MT5_INTERVALS);
}

export function BacktestForm({ onJobStarted }: Props) {
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [strategy, setStrategy]     = useState("sma_cross");
  const [source, setSource]         = useState("yfinance");
  const [symbol, setSymbol]         = useState("EURUSD=X");
  const [interval, setInterval]     = useState("1h");
  const [period, setPeriod]         = useState("1y");
  const [params, setParams]         = useState<Record<string, number | string>>({});
  const [initCash, setInitCash]     = useState(10000);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    listStrategies().then((s) => {
      setStrategies(s);
      if (s.length > 0) { setStrategy(s[0].key); initParams(s[0]); }
    }).catch(() => {});
  }, []);

  function initParams(s: StrategyInfo) {
    const defaults: Record<string, number | string> = {};
    for (const [k, v] of Object.entries(s.params)) defaults[k] = v.default;
    setParams(defaults);
  }

  function handleStrategyChange(key: string) {
    setStrategy(key);
    const s = strategies.find((s) => s.key === key);
    if (s) initParams(s);
  }

  function handleSourceChange(s: string) {
    setSource(s);
    setSymbol(s === "mt5" ? MT5_SYMBOLS[0] : YF_SYMBOLS[0]);
    const opts = getIntervalOptions(s, period);
    if (!opts.some((o) => o.value === interval)) setInterval(opts[0].value);
  }

  function handlePeriodChange(p: string) {
    setPeriod(p);
    if (source === "yfinance") {
      const opts = getIntervalOptions("yfinance", p);
      if (!opts.some((o) => o.value === interval)) setInterval(opts[0].value);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await startBacktest({ strategy, symbol, interval, period, source, params, init_cash: initCash });
      onJobStarted(res.job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const currentStrategy = strategies.find((s) => s.key === strategy);
  const symbols = source === "mt5" ? MT5_SYMBOLS : YF_SYMBOLS;
  const intervalOptions = getIntervalOptions(source, period);

  return (
    <form className="backtest-form" onSubmit={handleSubmit}>
      <h3>バックテスト設定</h3>

      {/* データソース */}
      <div className="form-row">
        <label>データソース</label>
        <div className="source-toggle">
          <button type="button"
            className={`source-btn${source === "mt5" ? " source-active" : ""}`}
            onClick={() => handleSourceChange("mt5")}
          >MT5</button>
          <button type="button"
            className={`source-btn${source === "yfinance" ? " source-active" : ""}`}
            onClick={() => handleSourceChange("yfinance")}
          >yfinance</button>
        </div>
      </div>

      <div className="form-row">
        <label>ストラテジー</label>
        <select value={strategy} onChange={(e) => handleStrategyChange(e.target.value)}>
          {strategies.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>シンボル</label>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>期間</label>
        <select value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>インターバル</label>
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          {intervalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>初期資金</label>
        <input type="number" value={initCash} min={1000} step={1000}
          onChange={(e) => setInitCash(Number(e.target.value))} />
      </div>

      {currentStrategy && Object.entries(currentStrategy.params).map(([k, schema]) => (
        <div key={k} className="form-row">
          <label>{schema.label}</label>
          <input type="number"
            value={params[k] ?? schema.default}
            min={schema.min} max={schema.max} step={1}
            onChange={(e) => setParams((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
          />
        </div>
      ))}

      {error && <p className="error-msg">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "送信中..." : "バックテスト実行"}
      </button>
    </form>
  );
}
