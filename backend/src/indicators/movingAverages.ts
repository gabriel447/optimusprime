import { EMA, SMA } from 'technicalindicators';
import type { Candle } from '../exchange/types.js';

export interface MAValues {
  mme9: number;
  mma21: number;
  mma200: number;
}

export interface MASeries {
  mme9: number[];
  mma21: number[];
  mma200: number[];
}

export function computeMovingAverages(candles: Candle[]): MASeries {
  const closes = candles.map((c) => c.close);

  const ema9 = EMA.calculate({ period: 9, values: closes });
  const sma21 = SMA.calculate({ period: 21, values: closes });
  const sma200 = SMA.calculate({ period: 200, values: closes });

  return {
    mme9: alignSeries(ema9, closes.length, 9),
    mma21: alignSeries(sma21, closes.length, 21),
    mma200: alignSeries(sma200, closes.length, 200),
  };
}

export function lastMAValues(series: MASeries): MAValues {
  const last = (arr: number[]) => arr[arr.length - 1] ?? NaN;
  return {
    mme9: last(series.mme9),
    mma21: last(series.mma21),
    mma200: last(series.mma200),
  };
}

function alignSeries(values: number[], targetLength: number, period: number): number[] {
  const offset = Math.max(0, period - 1);
  const result = new Array<number>(targetLength).fill(NaN);
  for (let i = 0; i < values.length; i += 1) {
    result[i + offset] = values[i] ?? NaN;
  }
  return result;
}
