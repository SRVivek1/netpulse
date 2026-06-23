/** Fixed speedo labels — evenly spaced on the arc, Ookla-style. */
export const GAUGE_TICKS = [0, 5, 10, 50, 100, 250, 500, 750, 1000] as const;

export const GAUGE_MAX_MBPS = GAUGE_TICKS[GAUGE_TICKS.length - 1];

/** Template 3/4 arc ring geometry (r=85, viewBox 200×200). */
export const ARC = {
  radius: 85,
  circumference: 534,
  sweepFraction: 0.75,
  trackDasharray: '400 134',
  progressDasharray: '534',
} as const;

/** Map Mbps to 0–1 arc position across evenly-spaced tick segments. */
export function mbpsToRatio(mbps: number, ticks: readonly number[] = GAUGE_TICKS): number {
  if (mbps <= 0 || ticks.length < 2) return 0;
  const max = ticks[ticks.length - 1];
  const v = Math.min(mbps, max);

  for (let i = 0; i < ticks.length - 1; i++) {
    const t0 = ticks[i];
    const t1 = ticks[i + 1];
    if (v <= t1) {
      const segStart = i / (ticks.length - 1);
      const segWidth = 1 / (ticks.length - 1);
      if (t1 === t0) return segStart + segWidth;
      const logFrac =
        (Math.log(v + 1) - Math.log(t0 + 1)) / (Math.log(t1 + 1) - Math.log(t0 + 1));
      return segStart + Math.min(1, Math.max(0, logFrac)) * segWidth;
    }
  }
  return 1;
}

/** Convert 0–1 ratio to SVG stroke-dashoffset for the 3/4 progress arc. */
export function arcRatioToDashOffset(ratio: number): number {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  return ARC.circumference - clamped * ARC.circumference * ARC.sweepFraction;
}

/** Map ping ms to arc ratio (100 ms = full sweep). */
export function pingMsToRatio(ms: number): number {
  return Math.min(ms / 100, 1);
}
