import { useEffect, useState } from "react";
import {
  deleteBars,
  deleteTicks,
  fetchBars,
  fetchTicks,
  getBarsPreview,
  getTicksPreview,
  listBars,
  listTicks,
} from "../api";
import { useSymbols } from "../hooks/useSymbols";
import type { BarRecord, DataFileInfo, TickRecord } from "../types";

const MT5_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk"];

type Tab = "bars" | "ticks";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DataManagerPage() {
  const [tab, setTab] = useState<Tab>("bars");

  return (
    <div className="page">
      <h2>データ管理</h2>
      <div className="source-toggle" style={{ marginBottom: "1rem" }}>
        <button
          className={`source-btn${tab === "bars" ? " source-active" : ""}`}
          onClick={() => setTab("bars")}
        >バーデータ</button>
        <button
          className={`source-btn${tab === "ticks" ? " source-active" : ""}`}
          onClick={() => setTab("ticks")}
        >ティックデータ</button>
      </div>
      {tab === "bars"  && <BarsTab />}
      {tab === "ticks" && <TicksTab />}
    </div>
  );
}

// ── バーデータタブ ────────────────────────────────────────────

function BarsTab() {
  const { symbols } = useSymbols();
  const [symbol,   setSymbol]   = useState("EURUSD");
  const [interval, setInterval] = useState("1h");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [files,    setFiles]    = useState<DataFileInfo[]>([]);
  const [preview,  setPreview]  = useState<{ fileId: string; data: BarRecord[] } | null>(null);

  useEffect(() => { loadList(); }, []);

  async function loadList() {
    try {
      setFiles(await listBars());
    } catch {
      /* 一覧取得失敗は無視 */
    }
  }

  async function handleFetch() {
    if (!dateFrom || !dateTo) { setError("開始日と終了日を入力してください"); return; }
    setLoading(true);
    setError(null);
    try {
      await fetchBars({ symbol, interval, date_from: dateFrom, date_to: dateTo });
      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "取得エラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await deleteBars(fileId);
      if (preview?.fileId === fileId) setPreview(null);
      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除エラー");
    }
  }

  async function handlePreview(fileId: string) {
    try {
      const res = await getBarsPreview(fileId, 100);
      setPreview({ fileId, data: res.data });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "プレビューエラー");
    }
  }

  return (
    <div>
      {/* 取得フォーム */}
      <div className="backtest-form" style={{ marginBottom: "1.5rem" }}>
        <h3>バーデータ取得</h3>
        <div className="form-row">
          <label>シンボル</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>インターバル</label>
          <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            {MT5_INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>開始日</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="form-row">
          <label>終了日</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button className="btn-primary" onClick={handleFetch} disabled={loading}>
          {loading ? "取得中..." : "MT5から取得・保存"}
        </button>
      </div>

      {/* 保存済み一覧 */}
      <h3>保存済みバーデータ</h3>
      {files.length === 0 ? (
        <p className="empty">保存済みデータなし</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ファイルID</th>
              <th>件数</th>
              <th>サイズ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.file_id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{f.file_id}</td>
                <td>{f.rows?.toLocaleString() ?? "—"}</td>
                <td>{formatBytes(f.size_bytes)}</td>
                <td>
                  <button onClick={() => handlePreview(f.file_id)} style={{ marginRight: "0.5rem" }}>プレビュー</button>
                  <button onClick={() => handleDelete(f.file_id)} style={{ color: "#ef5350" }}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* プレビュー */}
      {preview && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>プレビュー: {preview.fileId} <span style={{ fontSize: "0.8em", color: "#aaa" }}>（先頭100件）</span></h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>datetime</th><th>open</th><th>high</th><th>low</th><th>close</th><th>volume</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{r.datetime}</td>
                    <td>{r.open}</td><td>{r.high}</td><td>{r.low}</td><td>{r.close}</td><td>{r.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ティックデータタブ ────────────────────────────────────────

function TicksTab() {
  const { symbols } = useSymbols();
  const [symbol,  setSymbol]  = useState("EURUSD");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [files,    setFiles]    = useState<DataFileInfo[]>([]);
  const [preview,  setPreview]  = useState<{ fileId: string; data: TickRecord[] } | null>(null);

  useEffect(() => { loadList(); }, []);

  async function loadList() {
    try {
      setFiles(await listTicks());
    } catch {
      /* 一覧取得失敗は無視 */
    }
  }

  async function handleFetch() {
    if (!dateFrom || !dateTo) { setError("開始日と終了日を入力してください"); return; }
    setLoading(true);
    setError(null);
    try {
      await fetchTicks({ symbol, date_from: dateFrom, date_to: dateTo });
      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "取得エラー");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await deleteTicks(fileId);
      if (preview?.fileId === fileId) setPreview(null);
      await loadList();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "削除エラー");
    }
  }

  async function handlePreview(fileId: string) {
    try {
      const res = await getTicksPreview(fileId, 100);
      setPreview({ fileId, data: res.data });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "プレビューエラー");
    }
  }

  return (
    <div>
      {/* 取得フォーム */}
      <div className="backtest-form" style={{ marginBottom: "1.5rem" }}>
        <h3>ティックデータ取得</h3>
        <div className="form-row">
          <label>シンボル</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label>開始日</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="form-row">
          <label>終了日</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {error && <p className="error-msg">{error}</p>}
        <button className="btn-primary" onClick={handleFetch} disabled={loading}>
          {loading ? "取得中..." : "MT5から取得・保存"}
        </button>
      </div>

      {/* 保存済み一覧 */}
      <h3>保存済みティックデータ</h3>
      {files.length === 0 ? (
        <p className="empty">保存済みデータなし</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>ファイルID</th>
              <th>件数</th>
              <th>サイズ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.file_id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{f.file_id}</td>
                <td>{f.rows?.toLocaleString() ?? "—"}</td>
                <td>{formatBytes(f.size_bytes)}</td>
                <td>
                  <button onClick={() => handlePreview(f.file_id)} style={{ marginRight: "0.5rem" }}>プレビュー</button>
                  <button onClick={() => handleDelete(f.file_id)} style={{ color: "#ef5350" }}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* プレビュー */}
      {preview && (
        <div style={{ marginTop: "1.5rem" }}>
          <h3>プレビュー: {preview.fileId} <span style={{ fontSize: "0.8em", color: "#aaa" }}>（先頭100件）</span></h3>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>datetime</th><th>bid</th><th>ask</th><th>last</th><th>volume</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "monospace", fontSize: "0.85em" }}>{r.datetime}</td>
                    <td>{r.bid}</td><td>{r.ask}</td><td>{r.last ?? "—"}</td><td>{r.volume ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
