<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useBotStore } from '../stores/bot';
import { useTradesStore } from '../stores/trades';

const bot = useBotStore();
const trades = useTradesStore();
const { balances, status } = storeToRefs(bot);
const { pnlAllTime } = storeToRefs(trades);

const fmt = (v: number, digits = 4) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });

const fmtSigned = (v: number) =>
  (v >= 0 ? '+' : '') + fmt(v, 2);

const quoteAsset = computed(() => status.value.symbol.split('/')[1] ?? 'USDT');

const title = computed(() => (status.value.dryRun ? 'Saldo (DRY RUN)' : 'Saldo (Testnet)'));
</script>

<template>
  <section class="card balance-card">
    <h2>{{ title }}</h2>

    <div class="table-wrap">
      <table v-if="balances.length">
        <thead>
          <tr><th>Ativo</th><th>Total</th></tr>
        </thead>

        <tbody v-if="status.dryRun">
          <tr>
            <td><strong>{{ quoteAsset }}</strong></td>
            <td>
              <strong :class="pnlAllTime >= 0 ? 'pos' : 'neg'">
                {{ fmtSigned(pnlAllTime) }}
              </strong>
            </td>
          </tr>
        </tbody>

        <tbody v-else>
          <tr v-for="b in balances" :key="b.asset">
            <td><strong>{{ b.asset }}</strong></td>
            <td><strong>{{ fmt(b.total) }}</strong></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="empty">Sem saldos reportados ainda.</p>
    </div>
  </section>
</template>

<style scoped>
.balance-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.table-wrap::-webkit-scrollbar { width: 6px; }
.table-wrap::-webkit-scrollbar-track { background: transparent; }
.table-wrap::-webkit-scrollbar-thumb { background: #1f2744; border-radius: 3px; }
.table-wrap::-webkit-scrollbar-thumb:hover { background: #2a3458; }

table { width: 100%; }
thead th {
  position: sticky;
  top: 0;
  background: #141a30;
  z-index: 1;
}
tbody td { padding: 10px 8px; }

.empty { color: #6c7694; }
.muted { color: #6c7694; }
.pos { color: #57d28c; }
.neg { color: #ff7a7a; }
</style>
