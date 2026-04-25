<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useBotStore } from '../stores/bot';

const bot = useBotStore();
const { logs } = storeToRefs(bot);

const recent = computed(() => logs.value.slice(-150).reverse());
</script>

<template>
  <section class="card bot-logs">
    <header class="head">
      <h2>Logs do bot</h2>
      <span class="count" v-if="recent.length">{{ recent.length }} {{ recent.length === 1 ? 'evento' : 'eventos' }}</span>
    </header>

    <div class="scroll-wrap">
      <div v-if="recent.length" class="log-list">
        <div v-for="(l, i) in recent" :key="i" class="log-row" :class="l.level">
          <span class="time">{{ l.timestamp.slice(11, 19) }}</span>
          <span class="level">{{ l.level.toUpperCase() }}</span>
          <span class="scope">{{ l.scope }}</span>
          <span class="message">{{ l.message }}</span>
        </div>
      </div>
      <p v-else class="empty">Aguardando eventos do servidor…</p>
    </div>
  </section>
</template>

<style scoped>
.bot-logs {
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

.log-list {
  display: flex;
  flex-direction: column;
}

.log-row {
  display: grid;
  grid-template-columns: 64px 50px auto 1fr;
  gap: 10px;
  align-items: baseline;
  padding: 6px 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.4;
  border-bottom: 1px solid #1a2040;
}
.log-row:last-child { border-bottom: 0; }

.time { color: #6c7694; font-feature-settings: 'tnum'; }
.level {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #8a93b2;
}
.log-row.warn .level  { color: #f2b64c; }
.log-row.error .level { color: #ff7a7a; }
.log-row.debug .level { color: #6c7694; }
.scope { color: #8a93b2; }
.message {
  color: #c5cce0;
  word-break: break-word;
  white-space: pre-wrap;
}
.log-row.warn .message  { color: #f2b64c; }
.log-row.error .message { color: #ff7a7a; }
.log-row.debug .message { color: #6c7694; }

.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #6c7694;
  font-size: 13px;
  padding: 24px;
  margin: 0;
}
</style>
