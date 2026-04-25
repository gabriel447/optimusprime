import { env } from '../config/env.js';
import type { StrategySignal } from '../strategies/types.js';

export interface Position {
  amount: number;
  riskUsdt: number;
}

export function sizePosition(signal: StrategySignal): Position {
  const risk = Math.abs(signal.levels.entry - signal.levels.stop);
  if (risk <= 0) {
    throw new Error(`Risco inválido (${risk}) para ${signal.strategy}`);
  }
  const amount = env.RISK_PER_TRADE_USDT / risk;
  return { amount, riskUsdt: env.RISK_PER_TRADE_USDT };
}

export function computePnL(
  trade: { direction: 'buy' | 'sell'; entry: number; amount: number },
  closePrice: number,
): number {
  const delta = trade.direction === 'buy' ? closePrice - trade.entry : trade.entry - closePrice;
  return delta * trade.amount;
}
