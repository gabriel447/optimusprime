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
  openPrice: number;     // preço 24h atrás
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

export interface OrderResult {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  price?: number;
  amount: number;
  status: string;
  timestamp: number;
}
