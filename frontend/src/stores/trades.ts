import { defineStore } from 'pinia';
import type { StrategySignal, TradeView } from '../types';

interface State {
  signals: StrategySignal[];
  tradesById: Map<string, TradeView>;
}

export const useTradesStore = defineStore('trades', {
  state: (): State => ({
    signals: [],
    tradesById: new Map(),
  }),

  getters: {
    allTrades: (s) =>
      Array.from(s.tradesById.values()).sort((a, b) => b.openedAt - a.openedAt),

    closedTrades(): TradeView[] {
      return this.allTrades.filter((t) => t.status === 'closed');
    },

    stats(): {
      total: number; wins: number; losses: number; openCount: number;
      winRate: number; bestTrade: number; worstTrade: number;
    } {
      const list = this.allTrades;
      const closed = list.filter((t) => t.status === 'closed');
      const wins = closed.filter((t) => t.outcome === 'target').length;
      const losses = closed.filter((t) => t.outcome === 'stop').length;
      const pnls = closed.map((t) => t.pnlUsdt ?? 0);
      return {
        total: list.length,
        wins,
        losses,
        openCount: list.filter((t) => t.status === 'open').length,
        winRate: closed.length > 0 ? wins / closed.length : 0,
        bestTrade: Math.max(0, ...pnls),
        worstTrade: Math.min(0, ...pnls),
      };
    },

    pnlToday(): number {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      return this.allTrades
        .filter((t) => t.status === 'closed' && (t.closedAt ?? 0) >= start.getTime())
        .reduce((sum, t) => sum + (t.pnlUsdt ?? 0), 0);
    },

    pnlAllTime(): number {
      return this.allTrades
        .filter((t) => t.status === 'closed')
        .reduce((sum, t) => sum + (t.pnlUsdt ?? 0), 0);
    },
  },

  actions: {
    pushSignal(signal: StrategySignal) {
      this.signals.unshift(signal);
      if (this.signals.length > 50) this.signals.pop();
    },
    upsertTrade(trade: TradeView) {
      this.tradesById.set(trade.id, trade);
    },
  },
});
