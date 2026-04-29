import { createServer, type Server as HttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server as SocketServer } from 'socket.io';
import { env } from '../config/env.js';
import type { Balance, Candle, Ticker24h } from '../exchange/types.js';
import { logger, type LogEntry } from '../utils/logger.js';
import type { StrategySignal } from '../strategies/types.js';
import type { TradeRecord } from '../execution/orderManager.js';
import type { MarketState } from '../indicators/marketState.js';

export interface TradeView extends TradeRecord {
  status: 'open' | 'closed';
  closedAt?: number;
  closePrice?: number;
  outcome?: 'stop' | 'target' | 'timeout';
  pnlUsdt?: number;
}

export interface ServerToClientEvents {
  'bot:status': (payload: { running: boolean; dryRun: boolean; symbol: string; timeframe: string; startedAt: number }) => void;
  'bot:log': (entry: LogEntry) => void;
  'bot:price': (payload: { price: number; timestamp: number }) => void;
  'bot:balances': (payload: Balance[]) => void;
  'bot:candles': (payload: Candle[]) => void;
  'bot:candleUpdate': (payload: Candle) => void;
  'bot:ticker24h': (payload: Ticker24h) => void;
  'bot:market': (payload: MarketState) => void;
  'bot:signal': (payload: StrategySignal) => void;
  'bot:trade': (payload: TradeView) => void;
  'bot:tradeClosed': (payload: TradeView) => void;
}

export interface ClientToServerEvents {
  'bot:requestSnapshot': () => void;
}

export class DashboardServer {
  private readonly app = express();
  private readonly http: HttpServer;
  private readonly io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  private readonly startedAt = Date.now();

  private snapshot: {
    price: number;
    balances: Balance[];
    candles: Candle[];
    currentCandle: Candle | null;
    ticker24h: Ticker24h | null;
    trades: Map<string, TradeView>;
    market: MarketState | null;
  } = {
    price: 0, balances: [], candles: [], currentCandle: null,
    ticker24h: null, trades: new Map(), market: null,
  };

  constructor() {
    this.app.use(cors());
    this.app.get('/health', (_req, res) => res.json({ ok: true, symbol: env.SYMBOL }));

    this.http = createServer(this.app);
    this.io = new SocketServer<ClientToServerEvents, ServerToClientEvents>(this.http, {
      cors: { origin: '*' },
    });

    this.io.on('connection', (socket) => {
      logger.info('socket', `cliente conectado: ${socket.id}`);
      this.sendSnapshotTo(socket.id);
      socket.on('bot:requestSnapshot', () => this.sendSnapshotTo(socket.id));
      socket.on('disconnect', () => logger.debug('socket', `cliente desconectado: ${socket.id}`));
    });

    logger.on('log', (entry: LogEntry) => this.io.emit('bot:log', entry));
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.http.listen(env.SERVER_PORT, () => {
        logger.info('socket', `dashboard escutando em http://localhost:${env.SERVER_PORT}`);
        resolve();
      });
    });
  }

  seedHistory(trades: TradeView[]): void {
    for (const t of trades) this.snapshot.trades.set(t.id, t);
  }

  emitStatus(running: boolean): void {
    this.io.emit('bot:status', {
      running, dryRun: env.DRY_RUN, symbol: env.SYMBOL, timeframe: env.TIMEFRAME,
      startedAt: this.startedAt,
    });
  }

  emitPrice(price: number): void {
    this.snapshot.price = price;
    this.io.emit('bot:price', { price, timestamp: Date.now() });
  }

  emitBalances(balances: Balance[]): void {
    this.snapshot.balances = balances;
    this.io.emit('bot:balances', balances);
  }

  emitCandles(candles: Candle[]): void {
    this.snapshot.candles = candles.slice(-150);
    this.io.emit('bot:candles', this.snapshot.candles);
  }

  emitMarket(state: MarketState): void {
    this.snapshot.market = state;
    this.io.emit('bot:market', state);
  }

  emitCandleUpdate(candle: Candle): void {
    this.snapshot.currentCandle = candle;
    this.io.emit('bot:candleUpdate', candle);
  }

  emitTicker24h(ticker: Ticker24h): void {
    this.snapshot.ticker24h = ticker;
    this.io.emit('bot:ticker24h', ticker);
  }

  emitSignal(signal: StrategySignal): void {
    this.io.emit('bot:signal', signal);
  }

  emitTrade(trade: TradeRecord): void {
    const view: TradeView = { ...trade, status: 'open' };
    this.snapshot.trades.set(trade.id, view);
    this.io.emit('bot:trade', view);
  }

  emitTradeClosed(trade: TradeRecord, closePrice: number, outcome: 'stop' | 'target' | 'timeout', pnlUsdt: number, closedAt: number): void {
    const view: TradeView = { ...trade, status: 'closed', closePrice, outcome, pnlUsdt, closedAt };
    this.snapshot.trades.set(trade.id, view);
    this.io.emit('bot:tradeClosed', view);
  }

  private sendSnapshotTo(socketId: string): void {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;
    socket.emit('bot:status', {
      running: true, dryRun: env.DRY_RUN, symbol: env.SYMBOL, timeframe: env.TIMEFRAME,
      startedAt: this.startedAt,
    });
    socket.emit('bot:price', { price: this.snapshot.price, timestamp: Date.now() });
    socket.emit('bot:balances', this.snapshot.balances);
    socket.emit('bot:candles', this.snapshot.candles);
    if (this.snapshot.currentCandle) socket.emit('bot:candleUpdate', this.snapshot.currentCandle);
    if (this.snapshot.ticker24h) socket.emit('bot:ticker24h', this.snapshot.ticker24h);
    if (this.snapshot.market) socket.emit('bot:market', this.snapshot.market);
    for (const trade of this.snapshot.trades.values()) {
      socket.emit('bot:trade', trade);
      if (trade.status === 'closed') socket.emit('bot:tradeClosed', trade);
    }
  }
}
