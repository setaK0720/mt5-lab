import type {
  BacktestJobStatus,
  BarRecord,
  CalendarEvent,
  DataFileInfo,
  FredSeries,
  FredSeriesInfo,
  NewsArticle,
  OhlcvResponse,
  StrategyInfo,
  TickRecord,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Analysis
export const getOhlcv = (symbol: string, interval: string, period: string, source = "mt5") =>
  request<OhlcvResponse>(`/analysis/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${interval}&period=${period}&source=${source}`);

export const getIndicators = (symbol: string, interval: string, period: string, source = "mt5") =>
  request<OhlcvResponse>(`/analysis/indicators?symbol=${encodeURIComponent(symbol)}&interval=${interval}&period=${period}&source=${source}`);

export const listStrategies = () =>
  request<StrategyInfo[]>("/analysis/strategies");

export const startBacktest = (body: {
  strategy: string;
  symbol: string;
  interval: string;
  period: string;
  source?: string;
  params: Record<string, number | string>;
  init_cash?: number;
  fees?: number;
}) => request<{ job_id: string; status: string }>("/analysis/backtest", { method: "POST", body: JSON.stringify(body) });

export const getBacktestJob = (jobId: string) =>
  request<BacktestJobStatus>(`/analysis/backtest/${jobId}`);

// Data Manager — Bars
export const fetchBars = (body: { symbol: string; interval: string; date_from: string; date_to: string }) =>
  request<{ file_id: string; status: string }>("/data/bars/fetch", { method: "POST", body: JSON.stringify(body) });

export const listBars = () =>
  request<DataFileInfo[]>("/data/bars");

export const getBarsPreview = (file_id: string, limit = 500) =>
  request<{ file_id: string; data: BarRecord[] }>(`/data/bars/${encodeURIComponent(file_id)}/preview?limit=${limit}`);

export const deleteBars = (file_id: string) =>
  request<undefined>(`/data/bars/${encodeURIComponent(file_id)}`, { method: "DELETE" });

// Data Manager — Ticks
export const fetchTicks = (body: { symbol: string; date_from: string; date_to: string }) =>
  request<{ file_id: string; status: string }>("/data/ticks/fetch", { method: "POST", body: JSON.stringify(body) });

export const listTicks = () =>
  request<DataFileInfo[]>("/data/ticks");

export const getTicksPreview = (file_id: string, limit = 1000) =>
  request<{ file_id: string; data: TickRecord[] }>(`/data/ticks/${encodeURIComponent(file_id)}/preview?limit=${limit}`);

export const deleteTicks = (file_id: string) =>
  request<undefined>(`/data/ticks/${encodeURIComponent(file_id)}`, { method: "DELETE" });

// Research
export const listFredSeries = () =>
  request<FredSeriesInfo[]>("/research/fred/series");

export const getFredSeries = (series_id: string) =>
  request<FredSeries>(`/research/fred?series_id=${series_id}`);

export const getCalendar = () =>
  request<{ source: string; events: CalendarEvent[] }>("/research/calendar");

export const getNews = (q: string, pageSize = 20) =>
  request<{ articles: NewsArticle[]; total?: number; error?: string }>(`/research/news?q=${encodeURIComponent(q)}&page_size=${pageSize}`);
