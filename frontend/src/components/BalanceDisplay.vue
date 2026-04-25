<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useBotStore } from '../stores/bot';

const bot = useBotStore();
const { balances } = storeToRefs(bot);

const fmt = (v: number, digits = 4) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
</script>

<template>
  <section class="card balance-card">
    <h2>Saldo (Testnet)</h2>

    <div class="table-wrap">
      <table v-if="balances.length">
        <thead>
          <tr><th>Ativo</th><th>Livre</th><th>Em ordem</th><th>Total</th></tr>
        </thead>
        <tbody>
          <tr v-for="b in balances" :key="b.asset">
            <td><strong>{{ b.asset }}</strong></td>
            <td>{{ fmt(b.free) }}</td>
            <td>{{ fmt(b.used) }}</td>
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
</style>
