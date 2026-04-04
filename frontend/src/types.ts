// ---- Analysis ----

export interface OhlcvRecord {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema_20?: number | null;
  ema_50?: number | null;
  rsi_14?: number | null;
  macd?: number | null;
  macd_signal?: number | null;
  macd_hist?: number | null;
  bb_upper?: number | null;
  bb_mid?: number | null;
  bb_lower?: number | null;
}

export interface OhlcvResponse {
  symbol: string;
  interval: string;
  data: OhlcvRecord[];
}

export interface StrategyParam {
  type: "int" | "float" | "string";
  default: number | string;
  min?: number;
  max?: number;
  label: string;
}

export interface StrategyInfo {
  key: string;
  name: string;
  params: Record<string, StrategyParam>;
}

export interface BacktestTrade {
  id: number;
  entry_date: string;
  entry_price: number;
  exit_date: string;
  exit_price: number;
  size: number;
  pnl: number | null;
  return_pct: number | null;
  direction: string;
}

export interface BacktestJobStatus {
  status: "running" | "done" | "error";
  result?: {
    plot_json: string;
    stats: Record<string, number | string | null>;
    trades: BacktestTrade[];
  };
  error?: string;
}

// ---- Research ----

export interface FredObservation {
  date: string;
  value: number;
}

export interface FredSeries {
  series_id: string;
  title: string;
  observations: FredObservation[];
  error?: string;
}

export interface FredSeriesInfo {
  id: string;
  label: string;
}

export interface CalendarEvent {
  title: string;
  country: string;
  date: string;
  time: string;
  impact: string;
  forecast: string;
  previous: string;
  actual: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  published_at: string;
  source: string;
}
