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
  step?: number;
  options?: string[];
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
  nanpin_count?: number;
}

export interface PositionLogEntry {
  id: number;
  trade_id: number;
  type: string;
  direction: string;
  entry_date: string;
  entry_price: number;
  size: number;
  margin: number;
}

export interface BacktestJobStatus {
  status: "running" | "done" | "error";
  result?: {
    plot_json: string;
    stats: Record<string, number | string | null>;
    trades: BacktestTrade[];
    positions_log?: PositionLogEntry[];
  };
  error?: string;
}

// ---- Data Manager ----

export interface DataFileInfo {
  file_id: string;
  symbol: string;
  interval?: string;
  date_from: string;
  date_to: string;
  rows: number | null;
  size_bytes: number;
}

export interface BarRecord {
  datetime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread?: number;
  real_volume?: number;
}

export interface TickRecord {
  datetime: string;
  bid: number;
  ask: number;
  last?: number;
  volume?: number;
  [key: string]: unknown;
}

// ---- Stats ----

export interface ReturnsStats {
  count: number;
  mean: number | null;
  std: number | null;
  skew: number | null;
  kurt: number | null;
  min: number | null;
  max: number | null;
  p5: number | null;
  p25: number | null;
  p75: number | null;
  p95: number | null;
}

export interface ReturnsResult {
  stats: ReturnsStats;
  bins: number[];
  counts: number[];
}

export interface VolatilityResult {
  dates: string[];
  atr: (number | null)[];
  realized_vol: (number | null)[];
}

export interface CorrelationResult {
  symbols: string[];
  matrix: number[][];
}

export interface CandleTimeRow {
  label: string;
  key: number;
  bullish: number;
  bearish: number;
  neutral: number;
  total: number;
  bullish_pct: number | null;
  bearish_pct: number | null;
}

export interface CandleTimeResult {
  group_by: string;
  utc_offset: number;
  rows: CandleTimeRow[];
}

export interface DataSource {
  source: "file" | "mt5";
  file_id?: string;
  symbol?: string;
  interval?: string;
  period?: string;
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
