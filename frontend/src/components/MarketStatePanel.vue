<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useBotStore } from '../stores/bot';

const bot = useBotStore();
const { market, price } = storeToRefs(bot);

const trendLabel = computed(() => {
  if (!market.value) return '—';
  return { up: 'Tendência de alta', down: 'Tendência de baixa', lateral: 'Lateralizado' }[market.value.trend];
});
const trendClass = computed(() => {
  if (!market.value) return 'gray';
  return { up: 'green', down: 'red', lateral: 'amber' }[market.value.trend];
});
const ledClass = computed(() => {
  if (!market.value) return 'led-amber';
  return { up: 'led-green', down: 'led-red', lateral: 'led-amber' }[market.value.trend];
});
const strengthLevel = computed(() => {
  if (!market.value) return 0;
  const s = market.value.strength;
  if (s < 0.001) return 1;
  if (s < 0.005) return 2;
  return 3;
});
const strengthLabel = computed(() => ['—', 'fraca', 'moderada', 'forte'][strengthLevel.value] ?? '—');

const fmt = (v: number) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) : '—';

interface MaRow {
  name: string;
  role: string;
  value: number;
  belowPrice: boolean;
  deltaPct: number;
}

const mas = computed<MaRow[]>(() => {
  const m = market.value;
  if (!m) return [];
  const p = price.value;
  const make = (name: string, role: string, value: number): MaRow => ({
    name,
    role,
    value,
    belowPrice: value < p,
    deltaPct: p > 0 ? ((p - value) / p) * 100 : 0,
  });
  return [
    make('MME9', 'rápida', m.ma.mme9),
    make('MMA21', 'operacional', m.ma.mma21),
    make('MMA200', 'macro', m.ma.mma200),
  ];
});

const fmtDelta = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
</script>

<template>
  <section class="card market-panel">
    <h2>Estado do mercado</h2>

    <div v-if="market">
      <div class="trend-block">
        <span class="trend-eyebrow">Tendência</span>
        <div class="trend-main">
          <span class="led" :class="ledClass" />
          <span class="trend-label" :class="trendClass">{{ trendLabel }}</span>
        </div>

        <div class="strength-row">
          <span class="strength-eyebrow">Força</span>
          <span class="strength-meter" :class="trendClass">
            <span class="seg" :class="{ on: strengthLevel >= 1 }" />
            <span class="seg" :class="{ on: strengthLevel >= 2 }" />
            <span class="seg" :class="{ on: strengthLevel >= 3 }" />
          </span>
          <span class="strength-label">{{ strengthLabel }}</span>
        </div>
      </div>

      <div class="ma-section">
        <span class="ma-eyebrow">Posição do preço vs médias</span>
        <div class="ma-row" v-for="m in mas" :key="m.name">
          <div class="ma-id">
            <span class="ma-name">{{ m.name }}</span>
            <span class="ma-role">{{ m.role }}</span>
          </div>
          <span class="ma-value">{{ fmt(m.value) }}</span>
          <span
            class="ma-delta"
            :class="m.belowPrice ? 'pos' : 'neg'"
            :title="`Preço está ${m.belowPrice ? 'acima' : 'abaixo'} da ${m.name} em ${fmtDelta(m.deltaPct)}`"
          >
            <span class="arrow">{{ m.belowPrice ? '↑' : '↓' }}</span>
            {{ fmtDelta(m.deltaPct) }}
          </span>
        </div>
      </div>
    </div>

    <p v-else class="caption">Aquecendo indicadores… (precisa de 200 candles para a MMA200).</p>
  </section>
</template>

<style scoped>
/* TREND */
.trend-block {
  background: #0f1530;
  border: 1px solid #1f2744;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.trend-eyebrow,
.strength-eyebrow,
.ma-eyebrow {
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #6c7694;
}

.trend-main { display: flex; align-items: center; gap: 8px; }
.trend-label {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.01em;
}
.trend-label.green { color: #57d28c; }
.trend-label.red   { color: #ff7a7a; }
.trend-label.amber { color: #f2b64c; }
.trend-label.gray  { color: #8a93b2; }

.strength-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #1f2744;
}
.strength-meter { display: inline-flex; gap: 3px; }
.strength-meter .seg {
  display: inline-block;
  width: 18px;
  height: 5px;
  border-radius: 2px;
  background: #1f2744;
  transition: background 0.2s;
}
.strength-meter.green .seg.on { background: #57d28c; }
.strength-meter.red   .seg.on { background: #ff7a7a; }
.strength-meter.amber .seg.on { background: #f2b64c; }
.strength-meter.gray  .seg.on { background: #8a93b2; }
.strength-label {
  font-size: 12px;
  color: #e6e9f2;
  margin-left: auto;
  text-transform: lowercase;
}

/* MAs */
.ma-section {
  display: flex;
  flex-direction: column;
}
.ma-eyebrow {
  margin-bottom: 8px;
}
.ma-row {
  display: grid;
  grid-template-columns: minmax(110px, auto) 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 8px 4px;
  border-bottom: 1px solid #1a2040;
}
.ma-row:last-child { border-bottom: 0; }

.ma-id {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.ma-name {
  color: #e6e9f2;
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.04em;
}
.ma-role {
  color: #6c7694;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.ma-value {
  color: #c5cce0;
  font-size: 13px;
  font-feature-settings: 'tnum';
  text-align: right;
}
.ma-delta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  font-feature-settings: 'tnum';
  white-space: nowrap;
}
.ma-delta .arrow {
  font-size: 12px;
  font-weight: 700;
}

.caption { color: #6c7694; font-size: 12px; margin-top: 8px; line-height: 1.4; }
.pos { color: #57d28c; }
.neg { color: #ff7a7a; }
</style>
