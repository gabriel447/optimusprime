<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useTradesStore } from '../stores/trades';

const trades = useTradesStore();
const { stats, pnlAllTime } = storeToRefs(trades);

const fmt = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
const fmtPct = (v: number) => (v * 100).toFixed(0) + '%';

const pnlAllClass = computed(() => pnlAllTime.value >= 0 ? 'pos' : 'neg');
</script>

<template>
  <section class="card risk-panel">
    <h2>Gerenciamento de risco</h2>

    <div class="risk-grid">
      <div class="metric">
        <div class="metric-label">Total</div>
        <div class="metric-value" :class="pnlAllClass">{{ fmt(pnlAllTime) }} <span class="unit">USDT</span></div>
      </div>

      <div class="metric">
        <div class="metric-label">Win rate</div>
        <div class="metric-value">{{ fmtPct(stats.winRate) }}</div>
        <div class="metric-sub">{{ stats.wins }} alvos · {{ stats.losses }} stops</div>
      </div>

      <div class="metric">
        <div class="metric-label">Trades</div>
        <div class="metric-value">{{ stats.total }}</div>
        <div class="metric-sub">{{ stats.openCount }} abertos</div>
      </div>

      <div class="metric">
        <div class="metric-label">Melhor</div>
        <div class="metric-value pos">{{ fmt(stats.bestTrade) }} <span class="unit">USDT</span></div>
      </div>

      <div class="metric">
        <div class="metric-label">Pior</div>
        <div class="metric-value neg">{{ fmt(stats.worstTrade) }} <span class="unit">USDT</span></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.risk-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}
.metric {
  background: #0f1530;
  border: 1px solid #1f2744;
  border-radius: 8px;
  padding: 10px 12px;
}
.metric-label { font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase; color: #8a93b2; }
.metric-value { font-size: 22px; font-weight: 600; margin-top: 4px; font-feature-settings: 'tnum'; }
.metric-value.small { font-size: 14px; }
.metric-value .unit { font-size: 11px; color: #8a93b2; font-weight: 400; }
.metric-sub { font-size: 11px; color: #6c7694; margin-top: 2px; }
.pos { color: #57d28c; }
.neg { color: #ff7a7a; }

@media (max-width: 1100px) {
  .risk-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 640px) {
  .risk-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
