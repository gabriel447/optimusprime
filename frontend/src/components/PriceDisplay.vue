<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useNow } from '../composables/useNow';
import { useBotStore } from '../stores/bot';
import Sparkline from './Sparkline.vue';

const bot = useBotStore();
const { price, status, candles, lastPriceAt } = storeToRefs(bot);
const now = useNow(1000);

const formattedPrice = computed(() =>
  price.value > 0
    ? price.value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
    : '—',
);

const quoteAsset = computed(() => status.value.symbol.split('/')[1] ?? '');

const sparkValues = computed(() => candles.value.slice(-30).map((c) => c.close));

const lastUpdatedLabel = computed(() => {
  if (!lastPriceAt.value) return 'aguardando…';
  const seconds = Math.floor((now.value - lastPriceAt.value) / 1000);
  if (seconds < 2) return 'agora';
  if (seconds < 60) return `há ${seconds}s`;
  if (seconds < 3600) return `há ${Math.floor(seconds / 60)}m`;
  return `há ${Math.floor(seconds / 3600)}h`;
});
</script>

<template>
  <section class="card price-card">
    <header class="head">
      <div class="title">
        <span class="eyebrow">Preço atual</span>
        <span class="symbol">{{ status.symbol }} · {{ status.timeframe }}</span>
      </div>
      <span class="updated">
        <span class="led led-green pulse" />
        atualizado <strong>{{ lastUpdatedLabel }}</strong>
      </span>
    </header>

    <div class="hero">
      <span class="price">{{ formattedPrice }}</span>
      <span class="quote">{{ quoteAsset }}</span>
    </div>

    <div class="chart">
      <Sparkline :values="sparkValues" :height="72" />
    </div>
  </section>
</template>

<style scoped>
.price-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* HEADER */
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.title { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a93b2;
  font-weight: 500;
}
.symbol {
  font-size: 11px;
  color: #6c7694;
  font-feature-settings: 'tnum';
}
.updated {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6c7694;
  white-space: nowrap;
}
.updated strong { color: #8a93b2; font-weight: 500; }

/* HERO */
.hero {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.price {
  font-size: 40px;
  font-weight: 700;
  line-height: 1.05;
  font-feature-settings: 'tnum';
  letter-spacing: -0.01em;
  color: #e6e9f2;
}
.quote {
  font-size: 12px;
  color: #6c7694;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* CHART */
.chart {
  flex: 1;
  min-height: 80px;
  display: flex;
  align-items: stretch;
}
.chart > :deep(svg) { width: 100%; height: 100% !important; }
</style>
