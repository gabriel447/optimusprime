import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { Candle, Ticker24h } from './types.js';

const WS_BASE = 'wss://stream.testnet.binance.vision/stream';

interface KlinePayload {
  e: 'kline';
  E: number;
  s: string;
  k: {
    t: number; T: number; s: string; i: string;
    o: string; c: string; h: string; l: string; v: string;
    x: boolean;
  };
}

interface Ticker24hPayload {
  e: '24hrTicker';
  E: number;
  s: string;
  p: string;
  P: string;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
}

interface CombinedStreamMessage<T> {
  stream: string;
  data: T;
}

export class BinanceStream extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private shouldRun = false;

  start(): void {
    this.shouldRun = true;
    this.connect();
  }

  stop(): void {
    this.shouldRun = false;
    this.ws?.close();
    this.ws = null;
  }

  private connect(): void {
    const symbol = env.SYMBOL.replace('/', '').toLowerCase();
    const streams = [`${symbol}@kline_${env.TIMEFRAME}`, `${symbol}@ticker`];
    const url = `${WS_BASE}?streams=${streams.join('/')}`;

    logger.info('stream', `conectando ${url}`);
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempts = 0;
      logger.info('stream', `market data stream aberta (${streams.length} streams)`);
    });

    ws.on('message', (raw) => this.handleMessage(raw.toString()));

    ws.on('error', (err) => {
      logger.warn('stream', 'erro na WebSocket de market data', err.message);
    });

    ws.on('close', (code, reason) => {
      logger.warn('stream', `conexão fechada (${code})`, reason.toString());
      if (this.shouldRun) this.scheduleReconnect();
    });
  }

  private handleMessage(raw: string): void {
    let msg: CombinedStreamMessage<KlinePayload | Ticker24hPayload>;
    try {
      msg = JSON.parse(raw);
    } catch {
      logger.debug('stream', 'payload inválido (não-JSON)', raw.slice(0, 120));
      return;
    }

    const data = msg.data;
    if (!data) return;

    if (data.e === 'kline') this.handleKline(data);
    else if (data.e === '24hrTicker') this.handleTicker(data);
  }

  private handleKline(data: KlinePayload): void {
    const k = data.k;
    const candle: Candle = {
      timestamp: k.t,
      open: Number(k.o),
      high: Number(k.h),
      low: Number(k.l),
      close: Number(k.c),
      volume: Number(k.v),
    };

    this.emit('priceTick', candle.close);
    this.emit('candleUpdate', candle);
    if (k.x) this.emit('candleClosed', candle);
  }

  private handleTicker(data: Ticker24hPayload): void {
    const ticker: Ticker24h = {
      lastPrice: Number(data.c),
      openPrice: Number(data.o),
      highPrice: Number(data.h),
      lowPrice: Number(data.l),
      priceChange: Number(data.p),
      priceChangePercent: Number(data.P),
      volume: Number(data.v),
      timestamp: data.E,
    };
    this.emit('ticker24h', ticker);
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delayMs = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
    logger.info('stream', `reconectando em ${delayMs}ms (tentativa ${this.reconnectAttempts})`);
    setTimeout(() => this.shouldRun && this.connect(), delayMs);
  }
}
