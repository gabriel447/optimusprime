import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { Balance } from './types.js';

const REST_BASE = 'https://testnet.binance.vision';
const WS_BASE = 'wss://stream.testnet.binance.vision/ws';
const KEEPALIVE_INTERVAL_MS = 30 * 60 * 1000;

interface AccountUpdatePayload {
  e: 'outboundAccountPosition';
  E: number;
  B: { a: string; f: string; l: string }[];
}

interface ExecutionReportPayload {
  e: 'executionReport';
  s: string;
  c: string;
  S: 'BUY' | 'SELL';
  o: string;
  X: string;
  i: number;
  L: string;
  z: string;
}

type UserEvent = AccountUpdatePayload | ExecutionReportPayload;

export interface OrderFillEvent {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: string;
  status: string;
  price: number;
  amount: number;
}

export class UserDataStream extends EventEmitter {
  private ws: WebSocket | null = null;
  private listenKey: string | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private shouldRun = false;

  async start(): Promise<void> {
    this.shouldRun = true;
    try {
      this.listenKey = await this.createListenKey();
    } catch (err) {
      logger.warn(
        'userStream',
        'userDataStream desativado — endpoint REST não disponível',
        (err as Error).message.slice(0, 200),
      );
      this.emit('degraded', err);
      return;
    }

    this.connect();
    this.keepaliveTimer = setInterval(() => {
      this.keepaliveListenKey().catch((err) =>
        logger.warn('userStream', 'falha no keepalive do listenKey', (err as Error).message),
      );
    }, KEEPALIVE_INTERVAL_MS);
  }

  stop(): void {
    this.shouldRun = false;
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
    this.ws?.close();
    this.ws = null;
    if (this.listenKey) {
      this.closeListenKey().catch(() => {});
      this.listenKey = null;
    }
  }

  private connect(): void {
    if (!this.listenKey) return;
    const url = `${WS_BASE}/${this.listenKey}`;
    logger.info('userStream', `conectando userDataStream`);

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempts = 0;
      logger.info('userStream', 'user data stream aberta');
    });

    ws.on('message', (raw) => this.handleMessage(raw.toString()));

    ws.on('error', (err) => {
      logger.warn('userStream', 'erro na user WebSocket', err.message);
    });

    ws.on('close', (code) => {
      logger.warn('userStream', `user stream fechada (${code})`);
      if (this.shouldRun) this.scheduleReconnect();
    });
  }

  private handleMessage(raw: string): void {
    let msg: UserEvent;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.e === 'outboundAccountPosition') {
      const balances: Balance[] = msg.B
        .map((b) => ({
          asset: b.a,
          free: Number(b.f),
          used: Number(b.l),
          total: Number(b.f) + Number(b.l),
        }))
        .filter((b) => b.total > 0);
      this.emit('balance', balances);
      return;
    }

    if (msg.e === 'executionReport') {
      const fill: OrderFillEvent = {
        orderId: String(msg.i),
        symbol: msg.s,
        side: msg.S === 'BUY' ? 'buy' : 'sell',
        type: msg.o,
        status: msg.X,
        price: Number(msg.L),
        amount: Number(msg.z),
      };
      this.emit('orderFill', fill);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts += 1;
    const delayMs = Math.min(30_000, 500 * 2 ** this.reconnectAttempts);
    logger.info('userStream', `reconectando userDataStream em ${delayMs}ms`);
    setTimeout(async () => {
      if (!this.shouldRun) return;
      try {
        this.listenKey = await this.createListenKey();
        this.connect();
      } catch (err) {
        logger.error('userStream', 'falha ao recriar listenKey', (err as Error).message);
        this.scheduleReconnect();
      }
    }, delayMs);
  }

  private async createListenKey(): Promise<string> {
    const res = await fetch(`${REST_BASE}/api/v3/userDataStream`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': env.BINANCE_API_KEY },
    });
    if (!res.ok) throw new Error(`listenKey POST falhou: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { listenKey: string };
    logger.debug('userStream', `listenKey criado (${json.listenKey.slice(0, 8)}…)`);
    return json.listenKey;
  }

  private async keepaliveListenKey(): Promise<void> {
    if (!this.listenKey) return;
    const url = `${REST_BASE}/api/v3/userDataStream?listenKey=${this.listenKey}`;
    const res = await fetch(url, { method: 'PUT', headers: { 'X-MBX-APIKEY': env.BINANCE_API_KEY } });
    if (!res.ok) throw new Error(`listenKey PUT falhou: ${res.status}`);
    logger.debug('userStream', 'listenKey renovado');
  }

  private async closeListenKey(): Promise<void> {
    if (!this.listenKey) return;
    const url = `${REST_BASE}/api/v3/userDataStream?listenKey=${this.listenKey}`;
    await fetch(url, { method: 'DELETE', headers: { 'X-MBX-APIKEY': env.BINANCE_API_KEY } });
  }
}
