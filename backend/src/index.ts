import { join } from 'node:path';
import { env } from './config/env.js';
import { BinanceClient } from './exchange/binance.js';
import { BinanceStream } from './exchange/binanceStream.js';
import { UserDataStream, type OrderFillEvent } from './exchange/userDataStream.js';
import type { Candle, OrderResult } from './exchange/types.js';
import { OrderManager, type TradeRecord } from './execution/orderManager.js';
import { computeMarketState } from './indicators/marketState.js';
import { computeMovingAverages, lastMAValues } from './indicators/movingAverages.js';
import { TradeRepository, type PersistedTrade } from './persistence/tradeRepository.js';
import { DashboardServer, type TradeView } from './server/socketServer.js';
import { StrategyEngine } from './strategies/strategyEngine.js';
import { logger } from './utils/logger.js';

async function main() {
  const repo = new TradeRepository(join(process.cwd(), 'data', 'optimusprime.db'));
  const exchange = new BinanceClient();
  const server = new DashboardServer();
  const engine = new StrategyEngine();
  const orders = new OrderManager(exchange, repo);
  const marketStream = new BinanceStream();
  const userStream = new UserDataStream();

  await exchange.init();
  await server.start();

  const candles: Candle[] = await exchange.fetchCandles();
  logger.info('main', `histórico inicial: ${candles.length} candles`);
  server.emitCandles(candles);
  server.emitBalances(await exchange.fetchBalances());

  emitMarketIfReady(candles);

  const persisted = repo.findAll();
  logger.info('main', `histórico SQLite: ${persisted.length} trades`);
  server.seedHistory(persisted.map(toTradeView));

  const openInDb = repo.findOpen();
  if (openInDb) {
    const candlesSince = candles.filter((c) => c.timestamp >= openInDb.openedAt).length;
    orders.hydrateOpenTrade(persistedToRecord(openInDb), candlesSince);

    if (!env.DRY_RUN) {
      const closed = await orders.reconcileFromExchange();
      if (closed) {
        server.emitTradeClosed(closed.trade, closed.closePrice, closed.outcome, closed.pnlUsdt, closed.closedAt);
        logger.info('main', `reconcile: posição ${closed.outcome.toUpperCase()} encerrada enquanto offline`);
      }
    }
  }

  server.emitStatus(true);

  marketStream.on('priceTick', (price: number) => {
    server.emitPrice(price);
    if (env.DRY_RUN) {
      const closed = orders.reconcile(price);
      if (closed) server.emitTradeClosed(closed.trade, closed.closePrice, closed.outcome, closed.pnlUsdt, closed.closedAt);
    }
  });

  marketStream.on('candleUpdate', (candle: Candle) => server.emitCandleUpdate(candle));
  marketStream.on('ticker24h', (ticker) => server.emitTicker24h(ticker));

  marketStream.on('candleClosed', async (candle: Candle) => {
    candles.push(candle);
    if (candles.length > env.CANDLE_HISTORY_SIZE) candles.shift();
    server.emitCandles(candles);
    emitMarketIfReady(candles);

    if (orders.hasOpenPosition()) {
      try {
        const closed = await orders.onCandleClosed(candle);
        if (closed) {
          server.emitTradeClosed(closed.trade, closed.closePrice, closed.outcome, closed.pnlUsdt, closed.closedAt);
        }
      } catch (err) {
        logger.error('main', 'falha no gerenciamento de trade', (err as Error).message);
      }
    }

    if (orders.hasOpenPosition()) return;

    const signals = engine.evaluate(candles);
    for (const signal of signals) {
      server.emitSignal(signal);
      orders
        .executeSignal(signal)
        .then((trade) => { if (trade) server.emitTrade(trade); })
        .catch((err) => logger.error('main', 'falha ao executar sinal', (err as Error).message));
      break;
    }
  });

  userStream.on('balance', (balances) => server.emitBalances(balances));

  userStream.on('orderFill', (fill: OrderFillEvent) => {
    const closed = orders.onFill(fill);
    if (closed) server.emitTradeClosed(closed.trade, closed.closePrice, closed.outcome, closed.pnlUsdt, closed.closedAt);
  });

  let balanceFallbackTimer: ReturnType<typeof setInterval> | null = null;
  userStream.on('degraded', () => {
    logger.info('main', 'ativando fallback REST para saldo (30s)');
    balanceFallbackTimer = setInterval(async () => {
      try { server.emitBalances(await exchange.fetchBalances()); }
      catch (err) { logger.warn('main', 'falha ao atualizar saldo via REST', (err as Error).message); }
    }, 30_000);
  });

  marketStream.start();
  await userStream.start();

  function emitMarketIfReady(buffer: Candle[]): void {
    if (buffer.length < 200) return;
    const ma = computeMovingAverages(buffer);
    const last = buffer[buffer.length - 1]!;
    server.emitMarket(computeMarketState(last, lastMAValues(ma)));
  }

  const shutdown = (sig: string) => {
    logger.info('main', `sinal ${sig} recebido — encerrando`);
    marketStream.stop();
    userStream.stop();
    if (balanceFallbackTimer) clearInterval(balanceFallbackTimer);
    server.emitStatus(false);
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('main', 'unhandled rejection', reason));
  process.on('uncaughtException', (err) => logger.error('main', 'uncaught exception', err.message));
}

function toTradeView(p: PersistedTrade): TradeView {
  const base: TradeRecord = persistedToRecord(p);
  if (p.closedAt === null) return { ...base, status: 'open' };
  const pnlUsdt =
    p.closePrice !== null
      ? (p.direction === 'buy' ? p.closePrice - p.entry : p.entry - p.closePrice) * p.amount
      : 0;
  return {
    ...base,
    status: 'closed',
    closedAt: p.closedAt,
    closePrice: p.closePrice ?? undefined,
    outcome: p.outcome ?? undefined,
    pnlUsdt,
  };
}

function persistedToRecord(p: PersistedTrade): TradeRecord {
  const makeOrder = (realId: string | null, fallbackSuffix: string, price?: number): OrderResult => {
    if (realId) {
      return {
        id: realId, symbol: env.SYMBOL, side: p.direction,
        type: 'restored', price, amount: p.amount,
        status: 'open', timestamp: p.openedAt,
      };
    }
    return {
      id: `${p.id}-${fallbackSuffix}`, symbol: env.SYMBOL, side: p.direction,
      type: 'restored', price, amount: p.amount,
      status: 'restored', timestamp: p.openedAt,
    };
  };
  return {
    id: p.id,
    strategy: p.strategy,
    direction: p.direction,
    entry: p.entry,
    stop: p.stop,
    target: p.target,
    amount: p.amount,
    riskUsdt: p.riskUsdt,
    entryOrder: makeOrder(p.entryOrderId, 'entry', p.entry),
    stopOrder: makeOrder(p.stopOrderId, 'stop', p.stop),
    targetOrder: makeOrder(p.targetOrderId, 'target', p.target),
    openedAt: p.openedAt,
  };
}

main().catch((err) => {
  logger.error('main', 'falha fatal no bootstrap', (err as Error).message);
  process.exit(1);
});
