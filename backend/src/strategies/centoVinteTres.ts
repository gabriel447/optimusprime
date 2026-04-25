import type { Candle } from '../exchange/types.js';
import type { StrategyContext, StrategyDetector, StrategySignal, TradeLevels } from './types.js';

const REWARD_MULTIPLE = 1.5;
const TICK = 1e-6;

export const centoVinteTres: StrategyDetector = {
  name: 'CENTO_VINTE_TRES',

  detect(ctx: StrategyContext): StrategySignal | null {
    const { candles } = ctx;
    if (candles.length < 3) return null;

    const idx = candles.length - 1;
    const c1 = candles[idx - 2]!;
    const c2 = candles[idx - 1]!;
    const c3 = candles[idx]!;

    const isBullish = c3.close > c3.open && c2.low < c1.low && c2.low < c3.low;
    const isBearish = c3.close < c3.open && c2.high > c1.high && c2.high > c3.high;

    if (!isBullish && !isBearish) return null;

    const direction: 'buy' | 'sell' = isBullish ? 'buy' : 'sell';
    const levels = buildLevels(direction, c3, c2);

    return {
      strategy: 'CENTO_VINTE_TRES',
      direction,
      signalCandle: c3,
      levels,
      reason: `123 de ${direction === 'buy' ? 'fundo' : 'topo'}: pivô em c2 (${direction === 'buy' ? c2.low : c2.high}), c3 confirma`,
      detectedAt: Date.now(),
    };
  },
};

function buildLevels(direction: 'buy' | 'sell', c3: Candle, c2: Candle): TradeLevels {
  if (direction === 'buy') {
    const entry = c3.high + TICK;
    const stop = c2.low - TICK;
    const risk = entry - stop;
    return { entry, stop, target: entry + REWARD_MULTIPLE * risk, risk, rewardMultiple: REWARD_MULTIPLE };
  }
  const entry = c3.low - TICK;
  const stop = c2.high + TICK;
  const risk = stop - entry;
  return { entry, stop, target: entry - REWARD_MULTIPLE * risk, risk, rewardMultiple: REWARD_MULTIPLE };
}
