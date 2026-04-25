export function timeframeToMs(tf: string): number {
  const m = tf.match(/^(\d+)([mhdwM])$/);
  if (!m) return 60_000;
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!;
  const factor: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
    M: 30 * 86_400_000,
  };
  return n * (factor[unit] ?? 60_000);
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}min`;
  if (m > 0) return `${m}min ${s % 60}s`;
  return `${s}s`;
}

export function formatHHMM(ts: number): string {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
