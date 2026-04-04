import type {
  BacktestJobStatus,
  CalendarEvent,
  FredSeries,
  FredSeriesInfo,
  NewsArticle,
  OhlcvResponse,
  StrategyInfo,
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
export const getOhlcv = (symbol: string, interval: string, period: string, source = "yfinance") =>
  request<OhlcvResponse>(`/analysis/ohlcv?symbol=${encodeURIComponent(symbol)}&interval=${interval}&period=${period}&source=${source}`);

export const getIndicators = (symbol: string, interval: string, period: string, source = "yfinance") =>
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

// Research
export const listFredSeries = () =>
  request<FredSeriesInfo[]>("/research/fred/series");

export const getFredSeries = (series_id: string) =>
  request<FredSeries>(`/research/fred?series_id=${series_id}`);

export const getCalendar = () =>
  request<{ source: string; events: CalendarEvent[] }>("/research/calendar");

export const getNews = (q: string, pageSize = 20) =>
  request<{ articles: NewsArticle[]; total?: number; error?: string }>(`/research/news?q=${encodeURIComponent(q)}&page_size=${pageSize}`);
