import type { Candle } from '../exchange/types.js';
import { rle } from './rle.js';
import type { StrategyContext, StrategyDetector, StrategySignal, TradeLevels } from './types.js';

const RLE_SEARCH_WINDOW = 20;
const REWARD_MULTIPLE = 2;
const TICK = 1e-6;

export const primeiroTeste: StrategyDetector = {
  name: 'PRIMEIRO_TESTE',

  detect(ctx: StrategyContext): StrategySignal | null {
    const { candles, maSeries } = ctx;
    if (candles.length < RLE_SEARCH_WINDOW + 21) return null;

    const idx = candles.length - 1;
    const signal = candles[idx]!;
    const mma21Now = maSeries.mma21[idx];
    if (!Number.isFinite(mma21Now)) return null;

    const rleInfo = findRecentRle(ctx, idx);
    if (!rleInfo) return null;

    if (!touches(signal, mma21Now!)) return null;

    for (let i = rleInfo.index + 1; i < idx; i += 1) {
      const m = maSeries.mma21[i];
      const c = candles[i]!;
      if (Number.isFinite(m) && touches(c, m!)) return null;
    }

    const direction = rleInfo.direction;
    const levels = buildLevels(direction, signal);

    return {
      strategy: 'PRIMEIRO_TESTE',
      direction,
      signalCandle: signal,
      levels,
      reason: `Primeiro candle a testar a MMA21 (${mma21Now!.toFixed(4)}) após RLE ${direction === 'buy' ? 'de alta' : 'de baixa'}`,
      detectedAt: Date.now(),
    };
  },
};

function touches(c: Candle, price: number): boolean {
  return c.low <= price && c.high >= price;
}

function findRecentRle(ctx: StrategyContext, currentIdx: number): { index: number; direction: 'buy' | 'sell' } | null {
  const start = Math.max(21, currentIdx - RLE_SEARCH_WINDOW);

  for (let i = currentIdx - 1; i >= start; i -= 1) {
    const slice = ctx.candles.slice(0, i + 1);
    const subCtx: StrategyContext = {
      candles: slice,
      maSeries: {
        mme9: ctx.maSeries.mme9.slice(0, i + 1),
        mma21: ctx.maSeries.mma21.slice(0, i + 1),
        mma200: ctx.maSeries.mma200.slice(0, i + 1),
      },
      maLast: ctx.maLast,
    };
    const hit = rle.detect(subCtx);
    if (hit) return { index: i, direction: hit.direction };
  }
  return null;
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
