import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import {
  fetchCandleTime,
  fetchCorrelation,
  fetchReturns,
  fetchVolatility,
  listBars,
} from "../api";
import { useSymbols } from "../hooks/useSymbols";
import type {
  CandleTimeResult,
  CorrelationResult,
  DataFileInfo,
  DataSource,
  ReturnsResult,
  VolatilityResult,
} from "../types";
import { SymbolSelect } from "./SymbolSelect";

type Tab = "returns" | "volatility" | "correlation" | "candle_time";

const INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk"];
const PERIODS   = ["7d", "30d", "90d", "1y", "2y", "5y"];

// ---------------------------------------------------------------------------
// データソース選択コンポーネント
// ---------------------------------------------------------------------------
interface DataSourceFormProps {
  id: string;
  source: DataSource;
  onChange: (s: DataSource) => void;
  files: DataFileInfo[];
  symbols: string[];
}

function DataSourceForm({ id, source, onChange, files, symbols }: DataSourceFormProps) {
  return (
    <fieldset className="ds-form">
      <legend className="ds-legend">{id}</legend>
      <div className="ds-row">
        <label className="ds-radio">
          <input
            type="radio"
            name={`src-${id}`}
            checked={source.source === "file"}
            onChange={() => onChange({ ...source, source: "file" })}
          />
          保存済みファイル
        </label>
        <label className="ds-radio">
          <input
            type="radio"
            name={`src-${id}`}
            checked={source.source === "mt5"}
            onChange={() => onChange({ ...source, source: "mt5" })}
          />
          MT5から取得
        </label>
      </div>

      {source.source === "file" && (
        <div className="ds-row">
          <select
            value={source.file_id ?? ""}
            onChange={(e) => onChange({ ...source, file_id: e.target.value })}
          >
            <option value="">-- ファイルを選択 --</option>
            {files.map((f) => (
              <option key={f.file_id} value={f.file_id}>
                {f.symbol} ({f.interval ?? "-"}) {f.date_from}〜{f.date_to}
              </option>
            ))}
          </select>
        </div>
      )}

      {source.source === "mt5" && (
        <div className="ds-row ds-mt5">
          <SymbolSelect
            value={source.symbol ?? ""}
            onChange={(v) => onChange({ ...source, symbol: v })}
            symbols={symbols}
          />
          <select
            value={source.interval ?? "1h"}
            onChange={(e) => onChange({ ...source, interval: e.target.value })}
          >
            {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <select
            value={source.period ?? "90d"}
            onChange={(e) => onChange({ ...source, period: e.target.value })}
          >
            {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// リターン分布タブ
// ---------------------------------------------------------------------------
function ReturnsTab({ files, symbols }: { files: DataFileInfo[]; symbols: string[] }) {
  const [src, setSrc] = useState<DataSource>({ source: "file" });
  const [result, setResult] = useState<ReturnsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchReturns(src);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stat-panel">
      <DataSourceForm id="データソース" source={src} onChange={setSrc} files={files} symbols={symbols} />
      <button className="btn-primary" onClick={run} disabled={loading}>
        {loading ? "計算中..." : "計算"}
      </button>
      {error && <p className="error-msg">{error}</p>}
      {result && (
        <>
          <Plot
            data={[
              {
                type: "bar",
                x: result.bins.slice(0, -1).map((b, i) => ((b + result.bins[i + 1]) / 2 * 100)),
                y: result.counts,
                name: "頻度",
                marker: { color: "#3b82f6" },
              },
            ]}
            layout={{
              title: { text: "リターン分布" },
              xaxis: { title: { text: "リターン (%)" } },
              yaxis: { title: { text: "頻度" } },
              autosize: true,
              margin: { t: 40, r: 20, b: 50, l: 60 },
            }}
            useResizeHandler
            style={{ width: "100%", height: "360px" }}
          />
          <table className="stat-table">
            <tbody>
              {Object.entries(result.stats).map(([k, v]) => (
                <tr key={k}>
                  <th>{k}</th>
                  <td>{v === null ? "-" : typeof v === "number" ? (v * (k === "count" ? 1 : 100)).toFixed(k === "count" ? 0 : 4) + (k === "count" ? "" : "%") : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ボラティリティタブ
// ---------------------------------------------------------------------------
function VolatilityTab({ files, symbols }: { files: DataFileInfo[]; symbols: string[] }) {
  const [src, setSrc] = useState<DataSource>({ source: "file" });
  const [atrPeriod, setAtrPeriod] = useState(14);
  const [volWindow, setVolWindow] = useState(20);
  const [result, setResult] = useState<VolatilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchVolatility({ ...src, atr_period: atrPeriod, vol_window: volWindow });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stat-panel">
      <DataSourceForm id="データソース" source={src} onChange={setSrc} files={files} symbols={symbols} />
      <div className="ds-row">
        <label>ATR期間: <input type="number" value={atrPeriod} min={1} max={100} onChange={(e) => setAtrPeriod(Number(e.target.value))} style={{ width: 60 }} /></label>
        <label>ボラウィンドウ: <input type="number" value={volWindow} min={2} max={200} onChange={(e) => setVolWindow(Number(e.target.value))} style={{ width: 60 }} /></label>
      </div>
      <button className="btn-primary" onClick={run} disabled={loading}>
        {loading ? "計算中..." : "計算"}
      </button>
      {error && <p className="error-msg">{error}</p>}
      {result && (
        <Plot
          data={[
            {
              type: "scatter",
              mode: "lines",
              x: result.dates,
              y: result.atr,
              name: `ATR(${atrPeriod})`,
              line: { color: "#f59e0b" },
            },
            {
              type: "scatter",
              mode: "lines",
              x: result.dates,
              y: result.realized_vol,
              name: `実現ボラ(${volWindow})`,
              yaxis: "y2",
              line: { color: "#10b981" },
            },
          ]}
          layout={{
            title: { text: "ボラティリティ推移" },
            xaxis: { title: { text: "日付" } },
            yaxis: { title: { text: "ATR" } },
            yaxis2: { title: { text: "実現ボラ (年率)" }, overlaying: "y", side: "right" },
            autosize: true,
            margin: { t: 40, r: 80, b: 50, l: 60 },
            legend: { orientation: "h", y: -0.2 },
          }}
          useResizeHandler
          style={{ width: "100%", height: "400px" }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 相関分析タブ
// ---------------------------------------------------------------------------
function defaultSource(): DataSource {
  return { source: "file" };
}

function CorrelationTab({ files, symbols }: { files: DataFileInfo[]; symbols: string[] }) {
  const [sources, setSources] = useState<DataSource[]>([defaultSource(), defaultSource()]);
  const [result, setResult] = useState<CorrelationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSource(i: number, s: DataSource) {
    setSources((prev) => prev.map((x, idx) => (idx === i ? s : x)));
  }
  function addSource() {
    if (sources.length < 8) setSources((prev) => [...prev, defaultSource()]);
  }
  function removeSource(i: number) {
    if (sources.length > 2) setSources((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchCorrelation(sources);
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stat-panel">
      {sources.map((src, i) => (
        <div key={i} className="corr-source-row">
          <DataSourceForm
            id={`シンボル ${i + 1}`}
            source={src}
            onChange={(s) => updateSource(i, s)}
            files={files}
            symbols={symbols}
          />
          {sources.length > 2 && (
            <button className="btn-remove" onClick={() => removeSource(i)}>削除</button>
          )}
        </div>
      ))}
      {sources.length < 8 && (
        <button className="btn-secondary" onClick={addSource}>＋ シンボル追加</button>
      )}
      <button className="btn-primary" onClick={run} disabled={loading}>
        {loading ? "計算中..." : "計算"}
      </button>
      {error && <p className="error-msg">{error}</p>}
      {result && result.symbols.length >= 2 && (
        <>
          <Plot
            data={[
              {
                type: "heatmap",
                z: result.matrix,
                x: result.symbols,
                y: result.symbols,
                colorscale: "RdBu",
                zmin: -1,
                zmax: 1,
                text: result.matrix.map((row) => row.map((v) => v.toFixed(2))),
                texttemplate: "%{text}",
                showscale: true,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
            ]}
            layout={{
              title: { text: "相関行列" },
              autosize: true,
              margin: { t: 50, r: 20, b: 100, l: 100 },
            }}
            useResizeHandler
            style={{ width: "100%", height: "400px" }}
          />
          <table className="stat-table">
            <thead>
              <tr>
                <th></th>
                {result.symbols.map((s) => <th key={s}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {result.symbols.map((row, ri) => (
                <tr key={row}>
                  <th>{row}</th>
                  {result.matrix[ri].map((v, ci) => (
                    <td
                      key={ci}
                      style={{
                        background: v > 0 ? `rgba(59,130,246,${Math.abs(v) * 0.5})` : `rgba(239,68,68,${Math.abs(v) * 0.5})`,
                      }}
                    >
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 時間帯分析タブ
// ---------------------------------------------------------------------------
const GROUP_BY_OPTIONS: { value: string; label: string }[] = [
  { value: "hour",    label: "時刻（0〜23時）" },
  { value: "weekday", label: "曜日（月〜日）" },
  { value: "month",   label: "月（1〜12月）" },
];

const UTC_OFFSET_OPTIONS = [-12,-11,-10,-9,-8,-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,11,12];

function CandleTimeTab({ files, symbols }: { files: DataFileInfo[]; symbols: string[] }) {
  const [src, setSrc] = useState<DataSource>({ source: "file" });
  const [groupBy, setGroupBy] = useState("hour");
  const [utcOffset, setUtcOffset] = useState(3);
  const [result, setResult] = useState<CandleTimeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchCandleTime({ ...src, group_by: groupBy, utc_offset: utcOffset });
      setResult(r);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stat-panel">
      <DataSourceForm id="データソース" source={src} onChange={setSrc} files={files} symbols={symbols} />
      <div className="ds-row">
        <label>
          グルーピング:{" "}
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label>
          ブローカー時間 (UTC{utcOffset >= 0 ? "+" : ""}{utcOffset}):{" "}
          <select value={utcOffset} onChange={(e) => setUtcOffset(Number(e.target.value))}>
            {UTC_OFFSET_OPTIONS.map((n) => (
              <option key={n} value={n}>UTC{n >= 0 ? "+" : ""}{n}</option>
            ))}
          </select>
        </label>
      </div>
      <button className="btn-primary" onClick={run} disabled={loading}>
        {loading ? "計算中..." : "計算"}
      </button>
      {error && <p className="error-msg">{error}</p>}
      {result && (
        <table className="stat-table candle-time-table">
          <thead>
            <tr>
              <th>
                {groupBy === "hour" ? "時刻" : groupBy === "weekday" ? "曜日" : "月"}
                {groupBy === "hour" && (
                  <span style={{ fontSize: "11px", color: "#a0c4ff", fontWeight: "normal" }}>
                    {" "}(UTC{result.utc_offset >= 0 ? "+" : ""}{result.utc_offset})
                  </span>
                )}
              </th>
              <th>陽線数</th>
              <th>陰線数</th>
              <th>中立</th>
              <th>合計</th>
              <th>陽線率</th>
              <th>陰線率</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.key}>
                <th>{row.label}</th>
                <td style={{ color: "#22c55e" }}>{row.bullish}</td>
                <td style={{ color: "#ef4444" }}>{row.bearish}</td>
                <td>{row.neutral}</td>
                <td>{row.total}</td>
                <td style={{ background: bullishBg(row.bullish_pct) }}>
                  {row.bullish_pct !== null ? `${row.bullish_pct.toFixed(1)}%` : "-"}
                </td>
                <td style={{ background: bearishBg(row.bearish_pct) }}>
                  {row.bearish_pct !== null ? `${row.bearish_pct.toFixed(1)}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function bullishBg(pct: number | null): string {
  if (pct === null) return "";
  const intensity = Math.max(0, (pct - 50) / 50);
  return `rgba(34,197,94,${(intensity * 0.5).toFixed(2)})`;
}

function bearishBg(pct: number | null): string {
  if (pct === null) return "";
  const intensity = Math.max(0, (pct - 50) / 50);
  return `rgba(239,68,68,${(intensity * 0.5).toFixed(2)})`;
}

// ---------------------------------------------------------------------------
// メインページ
// ---------------------------------------------------------------------------
export function AnalysisPage() {
  const [tab, setTab] = useState<Tab>("returns");
  const [files, setFiles] = useState<DataFileInfo[]>([]);
  const { symbols } = useSymbols();

  useEffect(() => {
    listBars().then(setFiles).catch(() => {});
  }, []);

  const tabs: { key: Tab; label: string }[] = [
    { key: "returns",     label: "リターン分布" },
    { key: "volatility",  label: "ボラティリティ" },
    { key: "correlation", label: "相関分析" },
    { key: "candle_time", label: "時間帯分析" },
  ];

  return (
    <main className="main">
      <section className="section">
        <h2>統計分析</h2>
        <div className="tab-bar">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              className={`tab-btn${tab === key ? " tab-btn-active" : ""}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "returns"     && <ReturnsTab files={files} symbols={symbols} />}
        {tab === "volatility"  && <VolatilityTab files={files} symbols={symbols} />}
        {tab === "correlation" && <CorrelationTab files={files} symbols={symbols} />}
        {tab === "candle_time" && <CandleTimeTab files={files} symbols={symbols} />}
      </section>
    </main>
  );
}
