import type { Candle } from '../exchange/types.js';
import { computeMarketState, type TrendDirection } from '../indicators/marketState.js';
import { computeMovingAverages, lastMAValues } from '../indicators/movingAverages.js';
import { logger } from '../utils/logger.js';
import { barraIgnicao } from './barraIgnicao.js';
import { centoVinteTres } from './centoVinteTres.js';
import { precoReversao } from './precoReversao.js';
import { primeiroTeste } from './primeiroTeste.js';
import { rle } from './rle.js';
import type { StrategyDetector, StrategySignal } from './types.js';

export class StrategyEngine {
  private readonly detectors: StrategyDetector[] = [
    barraIgnicao,
    rle,
    primeiroTeste,
    centoVinteTres,
    precoReversao,
  ];

  evaluate(candles: Candle[]): StrategySignal[] {
    if (candles.length < 200) {
      logger.debug('engine', `ainda aquecendo indicadores (${candles.length}/200 candles)`);
      return [];
    }

    const maSeries = computeMovingAverages(candles);
    const maLast = lastMAValues(maSeries);
    const ctx = { candles, maSeries, maLast };
    const market = computeMarketState(candles[candles.length - 1]!, maLast);

    const signals: StrategySignal[] = [];

    for (const detector of this.detectors) {
      const signal = detector.detect(ctx);
      if (!signal) continue;

      const trendFavorable = isTrendFavorable(signal.direction, market.trend);
      if (!trendFavorable && signal.strategy !== 'BARRA_IGNICAO') {
        logger.info('engine', `sinal ${signal.strategy} descartado: tendência ${market.trend} não favorece ${signal.direction}`);
        continue;
      }
      if (!trendFavorable) {
        logger.warn('engine', `Barra de Ignição em tendência ${market.trend} (tolerado — pode ser quebra de movimento)`);
      }

      const maFavorable = isMaFavorable(signal.direction, maLast.mme9, maLast.mma21);
      if (!maFavorable && signal.strategy !== 'BARRA_IGNICAO') {
        logger.info('engine', `sinal ${signal.strategy} descartado: MME9/MMA21 contrárias`, maLast);
        continue;
      }
      if (!maFavorable) {
        logger.warn('engine', `Barra de Ignição com MME9/MMA21 contrárias (tolerado, mas não ideal)`, maLast);
      }

      if (isMma200Obstacle(signal, maLast.mma200)) {
        logger.info('engine', `sinal ${signal.strategy} descartado: MMA200 (${maLast.mma200.toFixed(4)}) obstrui o alvo`, signal.levels);
        continue;
      }

      signals.push(signal);
    }

    return signals;
  }
}

function isTrendFavorable(direction: 'buy' | 'sell', trend: TrendDirection): boolean {
  return direction === 'buy' ? trend === 'up' : trend === 'down';
}

function isMaFavorable(direction: 'buy' | 'sell', mme9: number, mma21: number): boolean {
  if (!Number.isFinite(mme9) || !Number.isFinite(mma21)) return false;
  return direction === 'buy' ? mme9 > mma21 : mme9 < mma21;
}

export function isMma200Obstacle(signal: StrategySignal, mma200: number): boolean {
  if (!Number.isFinite(mma200)) return false;
  const { entry, target } = signal.levels;

  if (signal.direction === 'buy') return mma200 > entry && mma200 < target;
  return mma200 < entry && mma200 > target;
}
