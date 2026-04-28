import type { BinanceClient } from '../exchange/binance.js';
import type { Candle, OrderResult } from '../exchange/types.js';
import type { OrderFillEvent } from '../exchange/userDataStream.js';
import type { TradeRepository } from '../persistence/tradeRepository.js';
import type { StrategySignal } from '../strategies/types.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { computePnL, sizePosition } from './riskManager.js';

export interface TradeRecord {
  id: string;
  strategy: StrategySignal['strategy'];
  direction: 'buy' | 'sell';
  entry: number;
  stop: number;
  target: number;
  amount: number;
  riskUsdt: number;
  entryOrder: OrderResult;
  stopOrder: OrderResult;
  targetOrder: OrderResult;
  openedAt: number;
}

export interface ClosedTradeOutcome {
  trade: TradeRecord;
  outcome: 'stop' | 'target';
  closePrice: number;
  closedAt: number;
  pnlUsdt: number;
}

export class OrderManager {
  private openTrade: TradeRecord | null = null;
  private candlesSinceEntry = 0;
  private breakevenApplied = false;

  constructor(
    private readonly exchange: BinanceClient,
    private readonly repo: TradeRepository,
  ) {}

  hasOpenPosition(): boolean {
    return this.openTrade !== null;
  }

  async executeSignal(signal: StrategySignal): Promise<TradeRecord | null> {
    if (this.openTrade) {
      logger.info('orders', `sinal ${signal.strategy} ignorado: já existe posição aberta`);
      return null;
    }

    const { amount, riskUsdt } = sizePosition(signal);

    try {
      const { entry, stop, target } = await this.exchange.placeBracketOrder({
        side: signal.direction,
        amount,
        stopPrice: signal.levels.stop,
        takeProfitPrice: signal.levels.target,
      });

      const trade: TradeRecord = {
        id: `${signal.strategy}-${Date.now()}`,
        strategy: signal.strategy,
        direction: signal.direction,
        entry: signal.levels.entry,
        stop: signal.levels.stop,
        target: signal.levels.target,
        amount,
        riskUsdt,
        entryOrder: entry,
        stopOrder: stop,
        targetOrder: target,
        openedAt: Date.now(),
      };

      this.openTrade = trade;
      this.candlesSinceEntry = 0;
      this.breakevenApplied = false;
      this.repo.insert({
        id: trade.id,
        strategy: trade.strategy,
        direction: trade.direction,
        entry: trade.entry,
        stop: trade.stop,
        target: trade.target,
        amount: trade.amount,
        riskUsdt: trade.riskUsdt,
        entryOrderId: entry.id,
        stopOrderId: stop.id,
        targetOrderId: target.id,
        openedAt: trade.openedAt,
        closedAt: null,
        closePrice: null,
        outcome: null,
      });
      logger.info('orders', `posição aberta: ${signal.strategy} ${signal.direction}`, {
        amount, entry: trade.entry, stop: trade.stop, target: trade.target,
      });
      return trade;
    } catch (err) {
      logger.error('orders', `falha ao executar ${signal.strategy}`, (err as Error).message);
      return null;
    }
  }

  onFill(event: OrderFillEvent): ClosedTradeOutcome | null {
    if (!this.openTrade || event.status !== 'FILLED') return null;

    const t = this.openTrade;
    const matchStop = event.orderId === t.stopOrder.id;
    const matchTarget = event.orderId === t.targetOrder.id;
    if (!matchStop && !matchTarget) return null;

    const outcome: 'stop' | 'target' = matchTarget ? 'target' : 'stop';
    return this.finalize(t, event.price, outcome, '');
  }

  reconcile(lastPrice: number): ClosedTradeOutcome | null {
    if (!this.openTrade) return null;

    const t = this.openTrade;
    const hitStop = t.direction === 'buy' ? lastPrice <= t.stop : lastPrice >= t.stop;
    const hitTarget = t.direction === 'buy' ? lastPrice >= t.target : lastPrice <= t.target;
    if (!hitStop && !hitTarget) return null;

    const outcome: 'stop' | 'target' = hitTarget ? 'target' : 'stop';
    return this.finalize(t, lastPrice, outcome, '[sim] ');
  }

  async onCandleClosed(candle: Candle): Promise<ClosedTradeOutcome | null> {
    if (!this.openTrade) return null;

    const t = this.openTrade;
    this.candlesSinceEntry++;

    if (!this.breakevenApplied && env.BREAKEVEN_AT_R > 0) {
      const risk = Math.abs(t.entry - t.stop);
      const breakevenThreshold = risk * env.BREAKEVEN_AT_R;
      const currentProfit = t.direction === 'buy'
        ? candle.high - t.entry
        : t.entry - candle.low;

      if (currentProfit >= breakevenThreshold) {
        const closeSide: 'buy' | 'sell' = t.direction === 'buy' ? 'sell' : 'buy';
        try {
          const newStop = await this.exchange.replaceStopOrder(
            t.stopOrder.id, closeSide, t.amount, t.entry,
          );
          t.stopOrder = newStop;
          t.stop = t.entry;
          this.breakevenApplied = true;
          logger.info('orders', `breakeven aplicado: stop movido para entrada @ ${t.entry}`);
        } catch (err) {
          logger.error('orders', 'falha ao mover stop para breakeven', (err as Error).message);
        }
      }
    }

    return null;
  }

  hydrateOpenTrade(trade: TradeRecord, candlesSinceEntry = 0): void {
    this.openTrade = trade;
    this.candlesSinceEntry = candlesSinceEntry;
    this.breakevenApplied = trade.stop === trade.entry;
    logger.info('orders', `posição aberta hidratada do banco: ${trade.strategy} ${trade.direction} (${candlesSinceEntry} candles decorridos)`);
  }

  async reconcileFromExchange(): Promise<ClosedTradeOutcome | null> {
    if (!this.openTrade) return null;

    const t = this.openTrade;
    const hasRealIds = t.stopOrder.status !== 'restored' && t.stopOrder.status !== 'simulated';
    if (!hasRealIds) {
      logger.warn('orders', 'reconcile: sem IDs reais da Binance — impossível consultar ordens');
      return null;
    }

    try {
      const [stopStatus, targetStatus] = await Promise.all([
        this.exchange.fetchOrder(t.stopOrder.id),
        this.exchange.fetchOrder(t.targetOrder.id),
      ]);

      logger.info('orders', `reconcile: stop=${stopStatus.status}, target=${targetStatus.status}`);

      const stopFilled = stopStatus.status === 'closed';
      const targetFilled = targetStatus.status === 'closed';

      if (targetFilled) {
        const closePrice = targetStatus.price ?? t.target;
        return this.finalize(t, closePrice, 'target', '[reconcile] ');
      }

      if (stopFilled) {
        const closePrice = stopStatus.price ?? t.stop;
        return this.finalize(t, closePrice, 'stop', '[reconcile] ');
      }

      logger.info('orders', 'reconcile: ordens ainda abertas na Binance, mantendo posição');
      return null;
    } catch (err) {
      logger.error('orders', 'reconcile: falha ao consultar ordens na Binance', (err as Error).message);
      return null;
    }
  }

  private finalize(
    trade: TradeRecord,
    closePrice: number,
    outcome: 'stop' | 'target',
    logPrefix: string,
  ): ClosedTradeOutcome {
    const closedAt = Date.now();
    const pnlUsdt = computePnL(trade, closePrice);
    this.repo.close(trade.id, closePrice, outcome, closedAt);
    this.openTrade = null;
    logger.info(
      'orders',
      `${logPrefix}posição encerrada (${outcome.toUpperCase()}) @ ${closePrice} — P&L ${pnlUsdt.toFixed(2)} USDT`,
    );
    return { trade, outcome, closePrice, closedAt, pnlUsdt };
  }
}
