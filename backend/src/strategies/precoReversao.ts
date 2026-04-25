import type { Candle } from '../exchange/types.js';
import type { StrategyContext, StrategyDetector, StrategySignal, TradeLevels } from './types.js';

const REWARD_MULTIPLE = 1.5;
const TICK = 1e-6;

export const precoReversao: StrategyDetector = {
  name: 'PRECO_REVERSAO',

  detect(ctx: StrategyContext): StrategySignal | null {
    const { candles } = ctx;
    if (candles.length < 3) return null;

    const idx = candles.length - 1;
    const signal = candles[idx]!;
    const prev1 = candles[idx - 1]!;
    const prev2 = candles[idx - 2]!;

    const isBullish =
      signal.low < prev1.low &&
      signal.low < prev2.low &&
      signal.close > prev1.close;

    const isBearish =
      signal.high > prev1.high &&
      signal.high > prev2.high &&
      signal.close < prev1.close;

    if (!isBullish && !isBearish) return null;

    const direction: 'buy' | 'sell' = isBullish ? 'buy' : 'sell';
    const levels = buildLevels(direction, signal);

    return {
      strategy: 'PRECO_REVERSAO',
      direction,
      signalCandle: signal,
      levels,
      reason: `Preço de Reversão ${direction === 'buy' ? 'altista' : 'baixista'}: pivô ${direction === 'buy' ? 'inferior' : 'superior'} + fechamento contra-corrente`,
      detectedAt: Date.now(),
    };
  },
};

function buildLevels(direction: 'buy' | 'sell', c: Candle): TradeLevels {
  if (direction === 'buy') {
    const entry = c.high + TICK;
    const stop = c.low - TICK;
    const risk = entry - stop;
    return { entry, stop, target: entry + REWARD_MULTIPLE * risk, risk, rewardMultiple: REWARD_MULTIPLE };
  }
  const entry = c.low - TICK;
  const stop = c.high + TICK;
  const risk = stop - entry;
  return { entry, stop, target: entry - REWARD_MULTIPLE * risk, risk, rewardMultiple: REWARD_MULTIPLE };
}
