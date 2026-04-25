import type { Candle } from '../exchange/types.js';
import type { MAValues } from './movingAverages.js';

export type TrendDirection = 'up' | 'down' | 'lateral';

export interface MarketState {
  trend: TrendDirection;
  strength: number;
  ma: MAValues;
  closeAboveMma200: boolean;
  closeAboveMma21: boolean;
}

export function computeMarketState(lastCandle: Candle, ma: MAValues): MarketState {
  const close = lastCandle.close;
  const fastAboveMid = ma.mme9 > ma.mma21;
  const midAboveMacro = ma.mma21 > ma.mma200;

  let trend: TrendDirection = 'lateral';
  if (fastAboveMid && midAboveMacro) trend = 'up';
  else if (!fastAboveMid && !midAboveMacro) trend = 'down';

  const strength =
    close > 0
      ? (Math.abs(ma.mme9 - ma.mma21) + Math.abs(ma.mma21 - ma.mma200)) / close
      : 0;

  return {
    trend,
    strength,
    ma,
    closeAboveMma200: close > ma.mma200,
    closeAboveMma21: close > ma.mma21,
  };
}
