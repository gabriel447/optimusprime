<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useBotStore } from '../stores/bot';

const bot = useBotStore();
const { status, connected } = storeToRefs(bot);
</script>

<template>
  <header class="app-header">
    <div class="title">
      <h1>OptimusPrime</h1>
      <span class="subtitle">Price Action Bot · método Lorenz</span>
    </div>

    <div class="status-pills">
      <span class="pill" :class="connected ? 'green' : 'red'">
        <span class="led" :class="[connected ? 'led-green' : 'led-red', { pulse: connected }]" />
        {{ connected ? 'conectado' : 'desconectado' }}
      </span>
      <span class="pill" :class="status.running ? 'green' : 'red'">
        <span class="led" :class="status.running ? 'led-green' : 'led-red'" />
        {{ status.running ? 'bot rodando' : 'bot parado' }}
      </span>
      <span class="pill" :class="status.dryRun ? 'amber' : 'green'">
        <span class="led" :class="status.dryRun ? 'led-amber' : 'led-green'" />
        {{ status.dryRun ? 'DRY RUN' : 'LIVE' }}
      </span>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  padding: 6px 4px 14px;
  border-bottom: 1px solid #1f2744;
  margin-bottom: 4px;
}
.title { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.01em; }
.subtitle { color: #8a93b2; font-size: 12px; }

.status-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}
.pill.amber { background: #2a2715; color: #f2b64c; }
</style>
