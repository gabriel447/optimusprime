export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown;
}

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Ticker24h {
  lastPrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChange: number;
  priceChangePercent: number;
  volume: number;
  timestamp: number;
}

export interface Balance {
  asset: string;
  free: number;
  used: number;
  total: number;
}

export type StrategyName =
  | 'BARRA_IGNICAO'
  | 'RLE'
  | 'PRIMEIRO_TESTE'
  | 'CENTO_VINTE_TRES'
  | 'PRECO_REVERSAO';
export type Direction = 'buy' | 'sell';
export type TrendDirection = 'up' | 'down' | 'lateral';
export type TradeOutcome = 'target' | 'stop' | 'manual';
export type TradeStatus = 'open' | 'closed';

export interface TradeLevels {
  entry: number;
  stop: number;
  target: number;
  risk: number;
  rewardMultiple: number;
}

export interface StrategySignal {
  strategy: StrategyName;
  direction: Direction;
  signalCandle: Candle;
  levels: TradeLevels;
  reason: string;
  detectedAt: number;
}

export interface TradeView {
  id: string;
  strategy: StrategyName;
  direction: Direction;
  entry: number;
  stop: number;
  target: number;
  amount: number;
  riskUsdt: number;
  openedAt: number;
  status: TradeStatus;
  closedAt?: number;
  closePrice?: number;
  outcome?: TradeOutcome;
  pnlUsdt?: number;
}

export interface MAValues {
  mme9: number;
  mma21: number;
  mma200: number;
}

export interface MarketState {
  trend: TrendDirection;
  strength: number;
  ma: MAValues;
  closeAboveMma200: boolean;
  closeAboveMma21: boolean;
}

export interface BotStatus {
  running: boolean;
  dryRun: boolean;
  symbol: string;
  timeframe: string;
  startedAt: number;
}

