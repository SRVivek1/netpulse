'use client';
import { formatMbps, formatMs, type SpeedPhase } from '../../../lib/speed';
import { cn } from '../../../lib/utils';

export interface SpeedMetrics {
  pingMs: number | null;
  jitterMs: number | null;
  downloadMbps: number | null;
  uploadMbps: number | null;
}

interface SpeedMetricsRowProps {
  metrics: SpeedMetrics;
  phase: SpeedPhase | 'idle';
  className?: string;
}

interface MetricCardProps {
  label: string;
  badge: string;
  badgeClass: string;
  value: string;
  unit: string;
  active: boolean;
  activeClass: string;
  borderAccent?: boolean;
}

function MetricCard({
  label,
  badge,
  badgeClass,
  value,
  unit,
  active,
  activeClass,
  borderAccent = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        'speed-glass-panel rounded-2xl p-4 flex flex-col justify-between transition-all duration-300',
        borderAccent && 'border-l-2',
        active && activeClass,
        !active && borderAccent && 'border-l-transparent',
      )}
    >
      <div className="flex items-center justify-between text-np-muted text-xs font-mono uppercase">
        <span>{label}</span>
        <span className={cn('text-[10px]', badgeClass)}>{badge}</span>
      </div>
      <div className="mt-2 flex items-baseline space-x-1">
        <span
          className={cn(
            'text-2xl font-mono font-bold tabular-nums',
            active ? 'text-np' : value === '—' ? 'text-np-faint' : 'text-np-muted',
          )}
        >
          {value}
        </span>
        <span className="text-xs text-np-faint font-mono">{unit}</span>
      </div>
    </div>
  );
}

function formatSpeed(value: number | null, live = false): string {
  if (value == null) return '—';
  if (live && value > 0) return value.toFixed(1);
  return formatMbps(value);
}

function formatLatency(value: number | null): string {
  if (value == null) return '—';
  return formatMs(value);
}

export function SpeedMetricsRow({ metrics, phase, className }: SpeedMetricsRowProps) {
  const pingActive = phase === 'ping';
  const downloadActive = phase === 'download';
  const uploadActive = phase === 'upload';

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-8', className)}>
      <MetricCard
        label="Ping latency"
        badge="ICMP"
        badgeClass="text-blue-400"
        value={formatLatency(metrics.pingMs)}
        unit="ms"
        active={pingActive}
        activeClass="bg-blue-500/5 border-blue-500/20"
      />
      <MetricCard
        label="Jitter Dev"
        badge="STDEV"
        badgeClass="text-purple-400"
        value={formatLatency(metrics.jitterMs)}
        unit="ms"
        active={pingActive}
        activeClass="bg-purple-500/5 border-purple-500/20"
      />
      <MetricCard
        label="Download RX"
        badge="▼"
        badgeClass="text-cyan-400"
        value={formatSpeed(metrics.downloadMbps, downloadActive)}
        unit="Mbps"
        active={downloadActive}
        activeClass="bg-cyan-500/5 border-cyan-500/20 border-l-cyan-400"
        borderAccent
      />
      <MetricCard
        label="Upload TX"
        badge="▲"
        badgeClass="text-fuchsia-400"
        value={formatSpeed(metrics.uploadMbps, uploadActive)}
        unit="Mbps"
        active={uploadActive}
        activeClass="bg-fuchsia-500/5 border-fuchsia-500/20 border-l-fuchsia-400"
        borderAccent
      />
    </div>
  );
}
