import { useEffect, useState } from "react";
import { listStrategies, startBacktest } from "../api";
import { useSymbols } from "../hooks/useSymbols";
import { SymbolSelect } from "./SymbolSelect";
import type { StrategyInfo } from "../types";

interface Props {
  onJobStarted: (jobId: string) => void;
}
const PERIODS     = ["90d", "1y", "2y", "5y"];
const MT5_INTERVALS = [
  { value: "15m", label: "15分" },
  { value: "30m", label: "30分" },
  { value: "1h",  label: "1時間" },
  { value: "4h",  label: "4時間" },
  { value: "1d",  label: "日足" },
  { value: "1wk", label: "週足" },
];

export function BacktestForm({ onJobStarted }: Props) {
  const { symbols } = useSymbols();
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [strategy, setStrategy]     = useState("sma_cross");
  const [symbol, setSymbol]         = useState("EURUSD");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await startBacktest({ strategy, symbol, interval, period, source: "mt5", params, init_cash: initCash });
      onJobStarted(res.job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const currentStrategy = strategies.find((s) => s.key === strategy);
  const intervalOptions = MT5_INTERVALS;

  return (
    <form className="backtest-form" onSubmit={handleSubmit}>
      <h3>バックテスト設定</h3>

      <div className="form-row">
        <label>ストラテジー</label>
        <select value={strategy} onChange={(e) => handleStrategyChange(e.target.value)}>
          {strategies.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>シンボル</label>
        <SymbolSelect value={symbol} onChange={setSymbol} symbols={symbols} />
      </div>
      <div className="form-row">
        <label>期間</label>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
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
