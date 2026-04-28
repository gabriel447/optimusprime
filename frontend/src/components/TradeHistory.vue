<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useTradesStore } from '../stores/trades';
import { formatDuration } from '../utils/time';

const trades = useTradesStore();
const { allTrades } = storeToRefs(trades);

const STRATEGY_LABELS: Record<string, string> = {
  BARRA_IGNICAO: 'Ignição',
  RLE: 'RLE',
  PRIMEIRO_TESTE: '1º Teste',
  CENTO_VINTE_TRES: '123',
  PRECO_REVERSAO: 'Reversão',
};

const fmtPnL = (v?: number) =>
  v === undefined ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2);

const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const pnlClass = (v?: number) => (v === undefined ? '' : v >= 0 ? 'pos' : 'neg');

const fmtDuration = (t: { openedAt: number; closedAt?: number | null }) =>
  t.closedAt ? formatDuration(t.closedAt - t.openedAt) : '—';
</script>

<template>
  <section class="card trade-history">
    <header class="head">
      <h2>Histórico de trades</h2>
      <span v-if="allTrades.length" class="count">{{ allTrades.length }} no total</span>
    </header>

    <div class="scroll-wrap" v-if="allTrades.length">
      <table>
        <thead>
          <tr>
            <th>Entrada</th>
            <th>Estratégia</th>
            <th>Status</th>
            <th>Duração</th>
            <th class="num">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in allTrades" :key="t.id">
            <td class="ts">{{ fmtTime(t.openedAt) }}</td>
            <td>
              <span class="strat">{{ STRATEGY_LABELS[t.strategy] ?? t.strategy }}</span>
              <span class="dir" :class="t.direction">{{ t.direction === 'buy' ? '↑' : '↓' }}</span>
            </td>
            <td>
              <span v-if="t.status === 'open'" class="pill gray">aberta</span>
              <span v-else-if="t.outcome === 'target'" class="pill green">alvo</span>
              <span v-else class="pill red">stop</span>
            </td>
            <td class="ts">{{ fmtDuration(t) }}</td>
            <td class="num" :class="pnlClass(t.pnlUsdt)">
              <strong>{{ fmtPnL(t.pnlUsdt) }}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.trade-history {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 240px;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.head h2 { margin: 0; }
.count { font-size: 11px; color: #6c7694; }

.scroll-wrap {
  flex: 1;
  min-height: 0;
  max-height: 380px;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
}
.scroll-wrap::-webkit-scrollbar { width: 6px; }
.scroll-wrap::-webkit-scrollbar-track { background: transparent; }
.scroll-wrap::-webkit-scrollbar-thumb { background: #1f2744; border-radius: 3px; }
.scroll-wrap::-webkit-scrollbar-thumb:hover { background: #2a3458; }

table { width: 100%; border-collapse: collapse; }
thead th {
  position: sticky;
  top: 0;
  background: #141a30;
  z-index: 1;
  white-space: nowrap;
  padding: 6px 10px;
}
tbody td { padding: 10px; }
.num { text-align: right; font-feature-settings: 'tnum'; }
.ts { color: #8a93b2; font-size: 11px; white-space: nowrap; }
.price { font-size: 12px; }
.strat { font-weight: 500; }
.dir { margin-left: 6px; font-weight: 700; }
.dir.buy { color: #57d28c; }
.dir.sell { color: #ff7a7a; }

.pill.yellow { background: rgba(255, 193, 7, 0.15); color: #ffc107; }

.pos { color: #57d28c; }
.neg { color: #ff7a7a; }
</style>
