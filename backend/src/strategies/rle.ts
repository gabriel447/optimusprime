import type { Candle } from '../exchange/types.js';
import { __internal as ignition } from './barraIgnicao.js';
import type { StrategyContext, StrategyDetector, StrategySignal, TradeLevels } from './types.js';

const MIN_LATERAL_CANDLES = 8;
const NARROWNESS_RATIO = 1.5;
const REWARD_MULTIPLE = 2;
const TICK = 1e-6;

export const rle: StrategyDetector = {
  name: 'RLE',

  detect(ctx: StrategyContext): StrategySignal | null {
    const { candles } = ctx;
    if (candles.length < MIN_LATERAL_CANDLES + 21) return null;

    const idx = candles.length - 1;
    const breakout = candles[idx]!;

    const priorToBreakout = candles.slice(idx - 20, idx);
    if (!ignition.isIgnition(breakout, priorToBreakout)) return null;

    const lateral = candles.slice(idx - MIN_LATERAL_CANDLES, idx);
    if (!isNarrowLateralization(lateral, candles.slice(idx - MIN_LATERAL_CANDLES - 20, idx - MIN_LATERAL_CANDLES))) {
      return null;
    }

    const lateralHigh = Math.max(...lateral.map((c) => c.high));
    const lateralLow = Math.min(...lateral.map((c) => c.low));

    let direction: 'buy' | 'sell' | null = null;
    if (breakout.close > lateralHigh) direction = 'buy';
    else if (breakout.close < lateralLow) direction = 'sell';
    if (direction === null) return null;

    const levels = buildLevels(direction, breakout);

    return {
      strategy: 'RLE',
      direction,
      signalCandle: breakout,
      levels,
      reason: `Rompimento ${direction === 'buy' ? 'da máxima' : 'da mínima'} da lateralização (${MIN_LATERAL_CANDLES} candles) por candle de força`,
      detectedAt: Date.now(),
    };
  },
};

function isNarrowLateralization(lateral: Candle[], context: Candle[]): boolean {
  if (lateral.length < MIN_LATERAL_CANDLES || context.length === 0) return false;

  const lateralRange = Math.max(...lateral.map((c) => c.high)) - Math.min(...lateral.map((c) => c.low));
  const avgContextRange = context.reduce((sum, c) => sum + (c.high - c.low), 0) / context.length;

  if (avgContextRange <= 0) return false;
  return lateralRange < NARROWNESS_RATIO * avgContextRange;
}

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

export const __rleInternal = { isNarrowLateralization };
