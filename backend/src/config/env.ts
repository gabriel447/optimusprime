import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  BINANCE_API_KEY: z.string().min(1, 'BINANCE_API_KEY é obrigatória'),
  BINANCE_API_SECRET: z.string().min(1, 'BINANCE_API_SECRET é obrigatória'),
  SYMBOL: z.string().default('BTC/USDT'),
  TIMEFRAME: z.string().default('15m'),
  CANDLE_HISTORY_SIZE: z.coerce.number().int().positive().default(300),
  RISK_PER_TRADE_USDT: z.coerce.number().positive().default(25),
  TRADE_EXPIRY_CANDLES: z.coerce.number().int().nonnegative().default(12),
  BREAKEVEN_AT_R: z.coerce.number().nonnegative().default(1),
  SERVER_PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DRY_RUN: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('[config] Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
