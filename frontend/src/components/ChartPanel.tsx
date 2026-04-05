import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { getIndicators } from "../api";
import { useSymbols } from "../hooks/useSymbols";
import { SymbolSelect } from "./SymbolSelect";
import type { OhlcvRecord } from "../types";

const ALL_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk"];
const PERIODS = ["7d", "30d", "90d", "1y", "2y", "5y"];

interface Props {
  defaultSymbol?: string;
  defaultInterval?: string;
  defaultPeriod?: string;
}

export function ChartPanel({ defaultSymbol = "EURUSD", defaultInterval = "1h", defaultPeriod = "30d" }: Props) {
  const { symbols } = useSymbols();
  const [symbol, setSymbol]     = useState(defaultSymbol);
  const [interval, setInterval] = useState(defaultInterval);
  const [period, setPeriod]     = useState(defaultPeriod);
  const [data, setData]         = useState<OhlcvRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => { load(); }, [symbol, interval, period]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await getIndicators(symbol, interval, period);
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "データ取得エラー");
    } finally {
      setLoading(false);
    }
  }

  const dates  = data.map((d) => d.datetime);
  const candlestickTrace = {
    type: "candlestick" as const,
    x: dates,
    open:  data.map((d) => d.open),
    high:  data.map((d) => d.high),
    low:   data.map((d) => d.low),
    close: data.map((d) => d.close),
    name: symbol,
    xaxis: "x", yaxis: "y",
    increasing: { line: { color: "#26a69a" } },
    decreasing: { line: { color: "#ef5350" } },
  };

  const ema20Trace = {
    type: "scatter" as const, x: dates,
    y: data.map((d) => d.ema_20 ?? null),
    name: "EMA20", line: { color: "#2196F3", width: 1 },
    xaxis: "x", yaxis: "y",
  };
  const ema50Trace = {
    type: "scatter" as const, x: dates,
    y: data.map((d) => d.ema_50 ?? null),
    name: "EMA50", line: { color: "#FF9800", width: 1 },
    xaxis: "x", yaxis: "y",
  };
  const rsiTrace = {
    type: "scatter" as const, x: dates,
    y: data.map((d) => d.rsi_14 ?? null),
    name: "RSI(14)", line: { color: "#9C27B0", width: 1 },
    xaxis: "x", yaxis: "y2",
  };

  const layout: Partial<Plotly.Layout> = {
    height: 560,
    paper_bgcolor: "#1e1e1e", plot_bgcolor: "#1e1e1e",
    font: { color: "#e0e0e0" },
    margin: { l: 50, r: 20, t: 30, b: 40 },
    legend: { orientation: "h", y: 1.05 },
    xaxis: { rangeslider: { visible: false }, gridcolor: "#333", domain: [0, 1] },
    yaxis: { title: { text: "価格" }, gridcolor: "#333", domain: [0.3, 1] },
    yaxis2: {
      title: { text: "RSI" }, range: [0, 100],
      gridcolor: "#333", domain: [0, 0.25], showgrid: true,
    },
    shapes: [
      { type: "line" as const, xref: "paper" as const, x0: 0, x1: 1, yref: "y2" as const, y0: 70, y1: 70, line: { color: "#ef5350", dash: "dot" as const, width: 1 } },
      { type: "line" as const, xref: "paper" as const, x0: 0, x1: 1, yref: "y2" as const, y0: 30, y1: 30, line: { color: "#26a69a", dash: "dot" as const, width: 1 } },
    ],
  };

  return (
    <div className="chart-panel">
      <div className="chart-controls">
        <SymbolSelect value={symbol} onChange={setSymbol} symbols={symbols} />
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
          {ALL_INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <button onClick={load} disabled={loading}>{loading ? "読込中..." : "更新"}</button>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {data.length > 0 && (
        <Plot
          data={[candlestickTrace, ema20Trace, ema50Trace, rsiTrace]}
          layout={layout}
          config={{ responsive: true, scrollZoom: true }}
          style={{ width: "100%" }}
        />
      )}
      {!loading && data.length === 0 && !error && (
        <p className="empty">データなし</p>
      )}
    </div>
  );
}
