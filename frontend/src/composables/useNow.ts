import { onBeforeUnmount, ref } from 'vue';

export function useNow(intervalMs = 1000) {
  const now = ref(Date.now());
  const handle = setInterval(() => { now.value = Date.now(); }, intervalMs);
  onBeforeUnmount(() => clearInterval(handle));
  return now;
}
