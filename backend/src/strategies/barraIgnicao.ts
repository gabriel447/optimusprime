import type { Candle } from '../exchange/types.js';
import type { StrategyContext, StrategyDetector, StrategySignal, TradeLevels } from './types.js';

const LOOKBACK = 20;
const MIN_BODY_RATIO = 0.8;
const REWARD_MULTIPLE = 2;
const TICK = 1e-6;
const PRIOR_MOMENTUM_WINDOW = 5;
const PRIOR_FLAT_THRESHOLD = 0.0005;

type PriorMovement = 'up' | 'down' | 'flat';

export const barraIgnicao: StrategyDetector = {
  name: 'BARRA_IGNICAO',

  detect(ctx: StrategyContext): StrategySignal | null {
    const { candles, maSeries } = ctx;
    if (candles.length < LOOKBACK + 2) return null;

    const idx = candles.length - 1;
    const signal = candles[idx]!;
    const prior = candles.slice(idx - LOOKBACK, idx);

    if (!isIgnition(signal, prior)) return null;

    const previous = candles[idx - 1]!;
    const previousPrior = candles.slice(idx - 1 - LOOKBACK, idx - 1);
    if (isIgnition(previous, previousPrior)) return null;

    const direction = signal.close > signal.open ? 'buy' : 'sell';

    const priorMovement = priorMme9Movement(maSeries.mme9, idx);
    if (priorMovement === 'up' && direction === 'buy') return null;
    if (priorMovement === 'down' && direction === 'sell') return null;

    const levels = buildLevels(direction, signal);

    return {
      strategy: 'BARRA_IGNICAO',
      direction,
      signalCandle: signal,
      levels,
      reason: `Amplitude ${(signal.high - signal.low).toFixed(4)} > 20 últimas; corpo ${(bodyRatio(signal) * 100).toFixed(1)}% ≥ 80%; quebra MME9 ${priorMovement}`,
      detectedAt: Date.now(),
    };
  },
};

function priorMme9Movement(mme9: number[], idx: number): PriorMovement {
  const recent = mme9[idx - 1];
  const past = mme9[idx - 1 - PRIOR_MOMENTUM_WINDOW];
  if (!Number.isFinite(recent) || !Number.isFinite(past) || past! <= 0) return 'flat';
  const change = (recent! - past!) / past!;
  if (change > PRIOR_FLAT_THRESHOLD) return 'up';
  if (change < -PRIOR_FLAT_THRESHOLD) return 'down';
  return 'flat';
}

function isIgnition(candle: Candle, prior: Candle[]): boolean {
  const range = candle.high - candle.low;
  if (range <= 0) return false;
  if (bodyRatio(candle) < MIN_BODY_RATIO) return false;

  return prior.every((c) => c.high - c.low < range);
}

function bodyRatio(c: Candle): number {
  const range = c.high - c.low;
  if (range <= 0) return 0;
  return Math.abs(c.close - c.open) / range;
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

export const __internal = { isIgnition, bodyRatio };
