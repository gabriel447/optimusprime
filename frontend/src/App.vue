<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import AppHeader from './components/AppHeader.vue';
import BalanceDisplay from './components/BalanceDisplay.vue';
import BotLogs from './components/BotLogs.vue';
import MarketStatePanel from './components/MarketStatePanel.vue';
import PriceDisplay from './components/PriceDisplay.vue';
import RiskPanel from './components/RiskPanel.vue';
import TradeHistory from './components/TradeHistory.vue';
import { useSocket } from './composables/useSocket';

const { connect, disconnect } = useSocket();

onMounted(() => connect());
onBeforeUnmount(() => disconnect());
</script>

<template>
  <div class="dashboard">
    <AppHeader />

    <section class="row top">
      <PriceDisplay />
      <MarketStatePanel />
      <BalanceDisplay />
    </section>

    <section class="row mid">
      <RiskPanel />
    </section>

    <section class="row bottom">
      <TradeHistory />
      <BotLogs />
    </section>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px 32px;
  min-height: 100vh;
  max-width: 1600px;
  margin: 0 auto;
}
.row { display: grid; gap: 16px; }
.row.top { grid-template-columns: 1.3fr 1fr 1fr; }
.row.mid { grid-template-columns: 1fr; }
.row.bottom { grid-template-columns: 3fr 2fr; }

@media (max-width: 1180px) {
  .row.top { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .row.top { grid-template-columns: 1fr; }
  .row.bottom { grid-template-columns: 1fr; }
}
</style>
