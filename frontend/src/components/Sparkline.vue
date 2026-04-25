<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  min?: number;
  max?: number;
}>();

const W = computed(() => props.width ?? 240);
const H = computed(() => props.height ?? 40);

const points = computed(() => {
  const vs = props.values;
  if (vs.length < 2) return '';

  const externalRange = props.min !== undefined && props.max !== undefined && props.max > props.min;
  const min = externalRange ? props.min! : Math.min(...vs);
  const max = externalRange ? props.max! : Math.max(...vs);
  const range = max - min || 1;

  const stepX = W.value / (vs.length - 1);
  const padY = 2;
  return vs
    .map((v, i) => {
      const x = i * stepX;
      const clamped = Math.max(min, Math.min(max, v));
      const y = H.value - padY - ((clamped - min) / range) * (H.value - 2 * padY);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
});

const computedColor = computed(() => {
  if (props.color) return props.color;
  const vs = props.values;
  if (vs.length < 2) return '#57d28c';
  return vs[vs.length - 1]! >= vs[0]! ? '#57d28c' : '#ff7a7a';
});
</script>

<template>
  <svg
    width="100%"
    :height="H"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="none"
    style="display: block;"
  >
    <polyline
      v-if="points"
      :points="points"
      fill="none"
      :stroke="computedColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
