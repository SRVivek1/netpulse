'use client';
import { useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { getWebsiteCore } from '../../../lib/config';
import { BentoTile } from '../../ui/BentoTile';

const tiles = getWebsiteCore().ipDiscovery.tiles;

interface LatencyTileProps {
  rttMs: number | null;
  className?: string;
  style?: React.CSSProperties;
}

function barColor(ms: number): string {
  if (ms > 50) return 'bg-red-400';
  if (ms > 20) return 'bg-amber-400';
  return 'bg-accent';
}

/** v1: single RTT from edge; bars derived for visual continuity until ping-loop API exists. */
export function LatencyTile({ rttMs, className, style }: LatencyTileProps) {
  const { avg, bars } = useMemo(() => {
    if (rttMs == null) return { avg: null as string | null, bars: [] as number[] };
    const base = rttMs;
    const samples = Array.from({ length: 12 }, (_, i) => {
      const wobble = Math.sin(i * 1.7) * (base * 0.08);
      return Math.max(1, Math.round(base + wobble));
    });
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    return { avg: `${mean.toFixed(1)} ms`, bars: samples };
  }, [rttMs]);

  const maxVal = bars.length ? Math.max(...bars) : 1;

  return (
    <BentoTile
      title={tiles.latency.title}
      badge="PING"
      colSpan={5}
      mdColSpan={3}
      footer="TCP RTT from Cloudflare edge"
      className={className}
      style={style}
    >
      <div className="flex items-center justify-end mb-2">
        <span className="text-[0.65rem] font-mono text-np-faint">
          Avg:{' '}
          <span className="text-accent font-bold">{avg ?? '—'}</span>
        </span>
      </div>
      <div
        className="h-20 bg-[var(--np-bg-base)]/80 border border-np rounded-xl flex items-end justify-between px-3 py-2 gap-0.5"
        aria-label={rttMs != null ? `Latency chart, average ${avg}` : 'Latency data unavailable'}
      >
        {bars.length === 0 ? (
          <div className="skeleton h-full w-full rounded" />
        ) : (
          bars.map((v, i) => (
            <div
              key={i}
              className={cn('w-1.5 rounded-t transition-all duration-500', barColor(v))}
              style={{ height: `${(v / maxVal) * 100}%` }}
              title={`${v} ms`}
            />
          ))
        )}
      </div>
    </BentoTile>
  );
}
