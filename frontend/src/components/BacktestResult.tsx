import { useEffect, useRef, useState } from "react";
import Plot from "react-plotly.js";
import { getBacktestJob } from "../api";
import type { BacktestJobStatus, BacktestTrade, PositionLogEntry } from "../types";

interface Props {
  jobId: string | null;
}

export function BacktestResult({ jobId }: Props) {
  const [job, setJob] = useState<BacktestJobStatus | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    setJob({ status: "running" });

    intervalRef.current = setInterval(async () => {
      try {
        const res = await getBacktestJob(jobId);
        setJob(res);
        if (res.status === "done" || res.status === "error") {
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [jobId]);

  if (!jobId || !job) return null;

  if (job.status === "running") {
    return <div className="backtest-result"><p className="loading-msg">バックテスト実行中...</p></div>;
  }

  if (job.status === "error") {
    return <div className="backtest-result"><p className="error-msg">エラー: {job.error}</p></div>;
  }

  if (!job.result) return null;

  const plotData = JSON.parse(job.result.plot_json);
  const stats = job.result.stats;
  const trades = job.result.trades ?? [];
  const positionsLog = job.result.positions_log ?? [];
  const hasNanpin = trades.some((t) => t.nanpin_count !== undefined);
  const [activeTab, setActiveTab] = useState<"trades" | "positions">("trades");

  return (
    <div className="backtest-result">
      <h3>バックテスト結果</h3>

      {/* エクイティカーブ */}
      <Plot
        data={plotData.data}
        layout={{
          ...plotData.layout,
          paper_bgcolor: "#1e1e1e",
          plot_bgcolor: "#1e1e1e",
          font: { color: "#e0e0e0" },
          height: 400,
          margin: { l: 50, r: 20, t: 30, b: 40 },
        }}
        config={{ responsive: true }}
        style={{ width: "100%" }}
      />

      {/* 統計サマリー */}
      <div className="stats-table-wrap">
        <h4>統計サマリー</h4>
        <table className="table">
          <tbody>
            {Object.entries(stats).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v === null ? "-" : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 履歴タブ */}
      {(trades.length > 0 || positionsLog.length > 0) && (
        <div className="trades-table-wrap">
          <div className="tab-bar">
            <button
              className={`tab-btn${activeTab === "trades" ? " active" : ""}`}
              onClick={() => setActiveTab("trades")}
            >
              注文履歴 <span className="badge">{trades.length}</span>
            </button>
            {positionsLog.length > 0 && (
              <button
                className={`tab-btn${activeTab === "positions" ? " active" : ""}`}
                onClick={() => setActiveTab("positions")}
              >
                ポジション履歴 <span className="badge">{positionsLog.length}</span>
              </button>
            )}
          </div>

          {activeTab === "trades" && (
            <div className="trades-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>方向</th>
                    <th>エントリー日時</th>
                    <th>エントリー価格</th>
                    <th>決済日時</th>
                    <th>決済価格</th>
                    <th>ロット</th>
                    <th>損益</th>
                    <th>投資収益率</th>
                    {hasNanpin && <th>ナンピン回数</th>}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <TradeRow key={t.id} trade={t} hasNanpin={hasNanpin} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "positions" && (
            <div className="trades-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>取引#</th>
                    <th>種別</th>
                    <th>方向</th>
                    <th>エントリー日時</th>
                    <th>エントリー価格</th>
                    <th>ロット</th>
                    <th>証拠金</th>
                  </tr>
                </thead>
                <tbody>
                  {positionsLog.map((p) => (
                    <PositionRow key={p.id} pos={p} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PositionRow({ pos }: { pos: PositionLogEntry }) {
  const isNanpin = pos.type !== "初回エントリー";
  return (
    <tr style={{ opacity: isNanpin ? 0.85 : 1 }}>
      <td>{pos.id}</td>
      <td>{pos.trade_id}</td>
      <td style={{ color: isNanpin ? "#ff9800" : "#26a69a" }}>{pos.type}</td>
      <td>{pos.direction}</td>
      <td className="trade-date">{pos.entry_date.slice(0, 16)}</td>
      <td>{pos.entry_price}</td>
      <td>{pos.size}</td>
      <td>{pos.margin.toLocaleString("ja-JP")}円</td>
    </tr>
  );
}

function TradeRow({ trade, hasNanpin }: { trade: BacktestTrade; hasNanpin: boolean }) {
  const isWin = (trade.pnl ?? 0) >= 0;
  return (
    <tr>
      <td>{trade.id}</td>
      <td>{trade.direction}</td>
      <td className="trade-date">{trade.entry_date.slice(0, 16)}</td>
      <td>{trade.entry_price}</td>
      <td className="trade-date">{trade.exit_date.slice(0, 16)}</td>
      <td>{trade.exit_price}</td>
      <td>{trade.size}</td>
      <td style={{ color: isWin ? "#26a69a" : "#ef5350", fontWeight: "bold" }}>
        {trade.pnl !== null ? (isWin ? "+" : "") + trade.pnl.toLocaleString("ja-JP") + "円" : "-"}
      </td>
      <td style={{ color: isWin ? "#26a69a" : "#ef5350" }}>
        {trade.return_pct !== null ? (isWin ? "+" : "") + trade.return_pct + "%" : "-"}
      </td>
      {hasNanpin && <td>{trade.nanpin_count ?? 0}</td>}
    </tr>
  );
}
