import { defineStore } from 'pinia';
import type { Balance, BotStatus, Candle, LogEntry, MarketState, Ticker24h } from '../types';

const MAX_LOGS = 500;

interface State {
  connected: boolean;
  status: BotStatus;
  price: number;
  lastPriceAt: number;
  balances: Balance[];
  candles: Candle[];
  currentCandle: Candle | null;
  ticker24h: Ticker24h | null;
  logs: LogEntry[];
  market: MarketState | null;
}

export const useBotStore = defineStore('bot', {
  state: (): State => ({
    connected: false,
    status: { running: false, dryRun: true, symbol: '—', timeframe: '—', startedAt: 0 },
    price: 0,
    lastPriceAt: 0,
    balances: [],
    candles: [],
    currentCandle: null,
    ticker24h: null,
    logs: [],
    market: null,
  }),

  getters: {
    usdtBalance: (s) => s.balances.find((b) => b.asset === 'USDT')?.total ?? 0,

    totalEquityUsdt(s): number {
      if (!s.status.symbol || s.status.symbol === '—') return 0;
      const [base, quote] = s.status.symbol.split('/');
      const baseAsset = s.balances.find((b) => b.asset === base);
      const quoteAsset = s.balances.find((b) => b.asset === quote);
      const baseValue = (baseAsset?.total ?? 0) * s.price;
      const quoteValue = quoteAsset?.total ?? 0;
      return baseValue + quoteValue;
    },

    currentCandleChangePct(s): number {
      const c = s.currentCandle;
      if (!c || c.open <= 0) return 0;
      return ((c.close - c.open) / c.open) * 100;
    },
  },

  actions: {
    setConnected(v: boolean) { this.connected = v; },
    setStatus(s: BotStatus) { this.status = s; },
    setPrice(p: number) { this.price = p; this.lastPriceAt = Date.now(); },
    setBalances(b: Balance[]) { this.balances = b; },
    setCandles(c: Candle[]) { this.candles = c; },
    setCurrentCandle(c: Candle) { this.currentCandle = c; },
    setTicker24h(t: Ticker24h) { this.ticker24h = t; },
    setMarket(m: MarketState) { this.market = m; },
    pushLog(entry: LogEntry) {
      this.logs.push(entry);
      if (this.logs.length > MAX_LOGS) this.logs.splice(0, this.logs.length - MAX_LOGS);
    },
  },
});
