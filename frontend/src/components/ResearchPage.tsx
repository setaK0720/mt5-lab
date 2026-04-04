import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { getCalendar, getFredSeries, getNews, listFredSeries } from "../api";
import type { CalendarEvent, FredSeries, FredSeriesInfo, NewsArticle } from "../types";

export function ResearchPage() {
  const [tab, setTab] = useState<"fred" | "calendar" | "news">("fred");

  return (
    <main className="main">
      <section className="section">
        <h2>リサーチ</h2>
        <div className="tab-bar">
          <button className={`tab-btn${tab === "fred" ? " tab-active" : ""}`} onClick={() => setTab("fred")}>経済指標（FRED）</button>
          <button className={`tab-btn${tab === "calendar" ? " tab-active" : ""}`} onClick={() => setTab("calendar")}>経済カレンダー</button>
          <button className={`tab-btn${tab === "news" ? " tab-active" : ""}`} onClick={() => setTab("news")}>ニュース</button>
        </div>
        {tab === "fred" && <FredPanel />}
        {tab === "calendar" && <CalendarPanel />}
        {tab === "news" && <NewsPanel />}
      </section>
    </main>
  );
}

// ---- FRED Panel ----

function FredPanel() {
  const [seriesList, setSeriesList] = useState<FredSeriesInfo[]>([]);
  const [selectedId, setSelectedId] = useState("DFF");
  const [data, setData] = useState<FredSeries | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFredSeries().then((list) => {
      setSeriesList(list);
      if (list.length > 0) setSelectedId(list[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadSeries();
  }, [selectedId]);

  async function loadSeries() {
    setLoading(true);
    setError(null);
    try {
      const res = await getFredSeries(selectedId);
      if (res.error) setError(res.error);
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "取得エラー");
    } finally {
      setLoading(false);
    }
  }

  const dates = data?.observations.map((o) => o.date) ?? [];
  const values = data?.observations.map((o) => o.value) ?? [];

  return (
    <div>
      <div className="chart-controls">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {seriesList.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.id})</option>)}
        </select>
        <button onClick={loadSeries} disabled={loading}>{loading ? "読込中..." : "更新"}</button>
      </div>
      {error && <p className="error-msg">{error}</p>}
      {data && dates.length > 0 && (
        <Plot
          data={[{
            type: "scatter",
            x: dates,
            y: values,
            mode: "lines",
            name: data.title,
            line: { color: "#2196F3" },
          }]}
          layout={{
            title: { text: data.title },
            paper_bgcolor: "#1e1e1e",
            plot_bgcolor: "#1e1e1e",
            font: { color: "#e0e0e0" },
            height: 400,
            margin: { l: 50, r: 20, t: 50, b: 40 },
            xaxis: { gridcolor: "#333" },
            yaxis: { gridcolor: "#333" },
          }}
          config={{ responsive: true }}
          style={{ width: "100%" }}
        />
      )}
      {!loading && data && dates.length === 0 && !error && (
        <p className="empty">データなし（FRED_API_KEYを設定してください）</p>
      )}
    </div>
  );
}

// ---- Calendar Panel ----

const IMPACT_COLORS: Record<string, string> = {
  High: "#ef5350",
  Medium: "#FF9800",
  Low: "#4caf50",
};

function CalendarPanel() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getCalendar()
      .then((res) => setEvents(res.events))
      .catch((e) => setError(e instanceof Error ? e.message : "取得エラー"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {loading && <p className="loading-msg">読込中...</p>}
      {error && <p className="error-msg">{error}</p>}
      {events.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>日付</th><th>時刻</th><th>国</th><th>指標</th><th>重要度</th>
              <th>予測</th><th>前回</th><th>結果</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={i}>
                <td>{ev.date}</td>
                <td>{ev.time}</td>
                <td>{ev.country}</td>
                <td>{ev.title}</td>
                <td style={{ color: IMPACT_COLORS[ev.impact] ?? "#e0e0e0" }}>{ev.impact}</td>
                <td>{ev.forecast || "-"}</td>
                <td>{ev.previous || "-"}</td>
                <td>{ev.actual || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && events.length === 0 && !error && (
        <p className="empty">経済カレンダーデータなし</p>
      )}
    </div>
  );
}

// ---- News Panel ----

function NewsPanel() {
  const [query, setQuery] = useState("USD JPY");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setLoading(true);
    setError(null);
    try {
      const res = await getNews(query);
      if (res.error) setError(res.error);
      setArticles(res.articles);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "取得エラー");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="chart-controls">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="キーワード検索..."
          style={{ minWidth: 200 }}
        />
        <button onClick={search} disabled={loading}>{loading ? "検索中..." : "検索"}</button>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="news-list">
        {articles.map((a, i) => (
          <div key={i} className="news-card">
            <a href={a.url} target="_blank" rel="noopener noreferrer" className="news-title">{a.title}</a>
            {a.description && <p className="news-desc">{a.description}</p>}
            <span className="news-meta">{a.source} · {a.published_at.slice(0, 10)}</span>
          </div>
        ))}
      </div>
      {!loading && articles.length === 0 && !error && (
        <p className="empty">検索してください（NEWS_API_KEYが必要）</p>
      )}
    </div>
  );
}
