import type { Candle } from '../exchange/types.js';
import type { MASeries, MAValues } from '../indicators/movingAverages.js';

export type StrategyName =
  | 'BARRA_IGNICAO'
  | 'RLE'
  | 'PRIMEIRO_TESTE'
  | 'CENTO_VINTE_TRES'
  | 'PRECO_REVERSAO';
export type Direction = 'buy' | 'sell';

export interface StrategyContext {
  candles: Candle[];
  maSeries: MASeries;
  maLast: MAValues;
}

export interface TradeLevels {
  entry: number;
  stop: number;
  target: number;
  risk: number;
  rewardMultiple: number;
}

export interface StrategySignal {
  strategy: StrategyName;
  direction: Direction;
  signalCandle: Candle;
  levels: TradeLevels;
  reason: string;
  detectedAt: number;
}

export interface StrategyDetector {
  name: StrategyName;
  detect(ctx: StrategyContext): StrategySignal | null;
}
