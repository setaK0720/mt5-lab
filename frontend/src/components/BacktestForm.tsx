import { useEffect, useState } from "react";
import { listStrategies, startBacktest } from "../api";
import { useSymbols } from "../hooks/useSymbols";
import { SymbolSelect } from "./SymbolSelect";
import type { StrategyInfo } from "../types";

interface Props {
  onJobStarted: (jobId: string) => void;
}
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
  const [symbol, setSymbol]         = useState("GOLDmicro");
  const [interval, setInterval]     = useState("1h");
  const today       = new Date().toISOString().slice(0, 10);
  const oneYearAgo  = new Date(Date.now() - 365 * 86400 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom]     = useState(oneYearAgo);
  const [dateTo, setDateTo]         = useState(today);
  const [params, setParams]         = useState<Record<string, number | string>>({});
  const [initCash, setInitCash]     = useState(1_000_000);
  const [fees, setFees]             = useState(0.0002);
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
      const res = await startBacktest({ strategy, symbol, interval, source: "mt5", params, init_cash: initCash, fees, date_from: dateFrom, date_to: dateTo });
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
        <label>開始日</label>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </div>
      <div className="form-row">
        <label>終了日</label>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
      <div className="form-row">
        <label>インターバル</label>
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          {intervalOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>初期資金 (円)</label>
        <input type="number" value={initCash} min={100_000} step={100_000}
          onChange={(e) => setInitCash(Number(e.target.value))} />
      </div>
      <div className="form-row">
        <label>手数料率</label>
        <input type="number" value={fees} min={0} max={0.01} step={0.0001}
          onChange={(e) => setFees(parseFloat(e.target.value))} />
      </div>

      {currentStrategy && Object.entries(currentStrategy.params).map(([k, schema]) => (
        <div key={k} className="form-row">
          <label>{schema.label}</label>
          {schema.type === "string" && schema.options ? (
            <select
              value={String(params[k] ?? schema.default)}
              onChange={(e) => setParams((prev) => ({ ...prev, [k]: e.target.value }))}
            >
              {schema.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input type="number"
              value={params[k] ?? schema.default}
              min={schema.min} max={schema.max}
              step={schema.type === "float" ? (schema.step ?? 0.1) : 1}
              onChange={(e) => setParams((prev) => ({
                ...prev,
                [k]: schema.type === "float" ? parseFloat(e.target.value) : Number(e.target.value),
              }))}
            />
          )}
        </div>
      ))}

      {error && <p className="error-msg">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary">
        {loading ? "送信中..." : "バックテスト実行"}
      </button>
    </form>
  );
}
