import { io, type Socket } from 'socket.io-client';
import { useBotStore } from '../stores/bot';
import { useTradesStore } from '../stores/trades';

const DEFAULT_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3001';

let socket: Socket | null = null;

export function useSocket() {
  const bot = useBotStore();
  const trades = useTradesStore();

  function connect(url: string = DEFAULT_URL) {
    if (socket) return socket;

    socket = io(url, { transports: ['websocket'], reconnection: true });

    socket.on('connect', () => {
      bot.setConnected(true);
      socket?.emit('bot:requestSnapshot');
    });
    socket.on('disconnect', () => bot.setConnected(false));

    socket.on('bot:status', (s) => bot.setStatus(s));
    socket.on('bot:price', ({ price }) => bot.setPrice(price));
    socket.on('bot:balances', (b) => bot.setBalances(b));
    socket.on('bot:candles', (c) => bot.setCandles(c));
    socket.on('bot:candleUpdate', (c) => bot.setCurrentCandle(c));
    socket.on('bot:ticker24h', (t) => bot.setTicker24h(t));
    socket.on('bot:market', (m) => bot.setMarket(m));
    socket.on('bot:log', (entry) => bot.pushLog(entry));
    socket.on('bot:signal', (signal) => trades.pushSignal(signal));
    socket.on('bot:trade', (trade) => trades.upsertTrade(trade));
    socket.on('bot:tradeClosed', (trade) => trades.upsertTrade(trade));

    return socket;
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
  }

  return { connect, disconnect };
}
