import ccxt, { type Exchange } from 'ccxt';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { Balance, Candle, OrderResult } from './types.js';

export class BinanceClient {
  private readonly exchange: Exchange;

  constructor() {
    this.exchange = new ccxt.binance({
      apiKey: env.BINANCE_API_KEY,
      secret: env.BINANCE_API_SECRET,
      enableRateLimit: true,
      options: { defaultType: 'spot' },
    });
    this.exchange.setSandboxMode(env.BINANCE_SANDBOX);
  }

  async init(): Promise<void> {
    await this.withRetry('loadMarkets', () => this.exchange.loadMarkets());
    const target = env.BINANCE_SANDBOX ? 'Testnet' : 'PRODUÇÃO';
    logger.info('exchange', `Binance ${target} conectada (${env.SYMBOL} @ ${env.TIMEFRAME})`);
  }

  async fetchCandles(limit = env.CANDLE_HISTORY_SIZE): Promise<Candle[]> {
    const raw = await this.withRetry('fetchOHLCV', () =>
      this.exchange.fetchOHLCV(env.SYMBOL, env.TIMEFRAME, undefined, limit),
    );

    return raw.map((c): Candle => ({
      timestamp: Number(c[0]),
      open: Number(c[1]),
      high: Number(c[2]),
      low: Number(c[3]),
      close: Number(c[4]),
      volume: Number(c[5]),
    }));
  }

  async fetchTicker(): Promise<number> {
    const ticker = await this.withRetry('fetchTicker', () => this.exchange.fetchTicker(env.SYMBOL));
    return Number(ticker.last ?? ticker.close ?? 0);
  }

  async fetchBalances(): Promise<Balance[]> {
    const bal = await this.withRetry('fetchBalance', () => this.exchange.fetchBalance());
    const free = bal.free as unknown as Record<string, number> | undefined;
    const used = bal.used as unknown as Record<string, number> | undefined;
    const total = bal.total as unknown as Record<string, number> | undefined;
    return env.SYMBOL.split('/').map((asset): Balance => ({
      asset,
      free: Number(free?.[asset] ?? 0),
      used: Number(used?.[asset] ?? 0),
      total: Number(total?.[asset] ?? 0),
    }));
  }

  async placeBracketOrder(params: {
    side: 'buy' | 'sell';
    amount: number;
    stopPrice: number;
    takeProfitPrice: number;
  }): Promise<{ entry: OrderResult; stop: OrderResult; target: OrderResult }> {
    const { side, amount, stopPrice, takeProfitPrice } = params;

    if (env.DRY_RUN) {
      logger.warn('exchange', 'DRY_RUN=true — ordem simulada, nada foi enviado', params);
      const now = Date.now();
      const mock = (id: string, type: string, price?: number): OrderResult => ({
        id, symbol: env.SYMBOL, side, type, price, amount, status: 'simulated', timestamp: now,
      });
      return {
        entry: mock('dry-entry', 'market'),
        stop: mock('dry-stop', 'stop_loss_limit', stopPrice),
        target: mock('dry-target', 'take_profit_limit', takeProfitPrice),
      };
    }

    const entry = await this.withRetry('createOrder.entry', () =>
      this.exchange.createOrder(env.SYMBOL, 'market', side, amount),
    );

    const closeSide: 'buy' | 'sell' = side === 'buy' ? 'sell' : 'buy';

    const stop = await this.withRetry('createOrder.stop', () =>
      this.exchange.createOrder(env.SYMBOL, 'STOP_LOSS_LIMIT', closeSide, amount, stopPrice, {
        stopPrice,
        timeInForce: 'GTC',
      }),
    );

    const target = await this.withRetry('createOrder.target', () =>
      this.exchange.createOrder(env.SYMBOL, 'TAKE_PROFIT_LIMIT', closeSide, amount, takeProfitPrice, {
        stopPrice: takeProfitPrice,
        timeInForce: 'GTC',
      }),
    );

    return {
      entry: this.normalizeOrder(entry as unknown as Record<string, unknown>, side),
      stop: this.normalizeOrder(stop as unknown as Record<string, unknown>, closeSide),
      target: this.normalizeOrder(target as unknown as Record<string, unknown>, closeSide),
    };
  }

  async fetchOrder(orderId: string): Promise<OrderResult> {
    const raw = await this.withRetry('fetchOrder', () =>
      this.exchange.fetchOrder(orderId, env.SYMBOL),
    );
    const o = raw as unknown as Record<string, unknown>;
    return {
      id: String(o['id'] ?? ''),
      symbol: String(o['symbol'] ?? env.SYMBOL),
      side: String(o['side'] ?? '') as 'buy' | 'sell',
      type: String(o['type'] ?? ''),
      price: o['price'] !== undefined && o['price'] !== null ? Number(o['price']) : undefined,
      amount: Number(o['amount'] ?? 0),
      status: String(o['status'] ?? ''),
      timestamp: Number(o['timestamp'] ?? Date.now()),
    };
  }

  async replaceStopOrder(oldOrderId: string, side: 'buy' | 'sell', amount: number, newStopPrice: number): Promise<OrderResult> {
    if (env.DRY_RUN) {
      logger.warn('exchange', `DRY_RUN=true — stop movido para ${newStopPrice} (simulado)`);
      return {
        id: `dry-stop-${Date.now()}`, symbol: env.SYMBOL, side, type: 'stop_loss_limit',
        price: newStopPrice, amount, status: 'simulated', timestamp: Date.now(),
      };
    }

    await this.withRetry('cancelOrder.oldStop', () =>
      this.exchange.cancelOrder(oldOrderId, env.SYMBOL),
    );

    const newStop = await this.withRetry('createOrder.newStop', () =>
      this.exchange.createOrder(env.SYMBOL, 'STOP_LOSS_LIMIT', side, amount, newStopPrice, {
        stopPrice: newStopPrice,
        timeInForce: 'GTC',
      }),
    );

    return this.normalizeOrder(newStop as unknown as Record<string, unknown>, side);
  }

  async closePositionAtMarket(params: {
    side: 'buy' | 'sell';
    amount: number;
    stopOrderId: string;
    targetOrderId: string;
  }): Promise<OrderResult> {
    const { side, amount, stopOrderId, targetOrderId } = params;
    const closeSide: 'buy' | 'sell' = side === 'buy' ? 'sell' : 'buy';

    if (env.DRY_RUN) {
      logger.warn('exchange', 'DRY_RUN=true — fechamento a mercado simulado', params);
      return {
        id: `dry-close-${Date.now()}`, symbol: env.SYMBOL, side: closeSide, type: 'market',
        amount, status: 'simulated', timestamp: Date.now(),
      };
    }

    for (const [label, id] of [['stop', stopOrderId], ['target', targetOrderId]] as const) {
      try {
        await this.withRetry(`cancelOrder.${label}`, () =>
          this.exchange.cancelOrder(id, env.SYMBOL),
        );
      } catch (err) {
        logger.warn('exchange', `falha ao cancelar ${label} ${id} (já preenchida?)`, (err as Error).message);
      }
    }

    const close = await this.withRetry('createOrder.close', () =>
      this.exchange.createOrder(env.SYMBOL, 'market', closeSide, amount),
    );
    return this.normalizeOrder(close as unknown as Record<string, unknown>, closeSide);
  }

  async cancelOrder(orderId: string): Promise<void> {
    if (env.DRY_RUN) {
      logger.warn('exchange', `DRY_RUN=true — cancelamento simulado da ordem ${orderId}`);
      return;
    }

    await this.withRetry('cancelOrder', () =>
      this.exchange.cancelOrder(orderId, env.SYMBOL),
    );
    logger.info('exchange', `ordem ${orderId} cancelada`);
  }

  private normalizeOrder(o: Record<string, unknown>, side: 'buy' | 'sell'): OrderResult {
    return {
      id: String(o['id'] ?? ''),
      symbol: String(o['symbol'] ?? env.SYMBOL),
      side,
      type: String(o['type'] ?? ''),
      price: o['price'] !== undefined ? Number(o['price']) : undefined,
      amount: Number(o['amount'] ?? 0),
      status: String(o['status'] ?? 'open'),
      timestamp: Number(o['timestamp'] ?? Date.now()),
    };
  }

  private async withRetry<T>(op: string, fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
    let attempt = 0;
    let lastErr: unknown;

    while (attempt < maxAttempts) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        const recoverable =
          err instanceof ccxt.RateLimitExceeded ||
          err instanceof ccxt.NetworkError ||
          err instanceof ccxt.DDoSProtection ||
          err instanceof ccxt.RequestTimeout;

        if (!recoverable) {
          logger.error('exchange', `${op} falhou (não recuperável)`, (err as Error).message);
          throw err;
        }

        attempt += 1;
        const delayMs = Math.min(30_000, 500 * 2 ** attempt);
        logger.warn('exchange', `${op} falhou (tentativa ${attempt}/${maxAttempts}) — retry em ${delayMs}ms`, (err as Error).message);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    throw lastErr;
  }
}
