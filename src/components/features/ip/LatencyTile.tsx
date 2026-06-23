'use client';
import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { getWebsiteCore, getSiteConfig } from '../../../lib/config';
import { formatMs, measurePing } from '../../../lib/speed';
import { BentoTile } from '../../ui/BentoTile';

const copy = getWebsiteCore().ipDiscovery.tiles.latency;
const pingConfig = getSiteConfig().speedTest;

type Status = 'measuring' | 'done' | 'error';

interface LatencyTileProps {
  colo?: string | null;
  className?: string;
  style?: React.CSSProperties;
}

function barColor(ms: number): string {
  if (ms > 50) return 'bg-red-400';
  if (ms > 20) return 'bg-amber-400';
  return 'bg-accent';
}

function qualityLabel(ms: number): { text: string; className: string } {
  if (ms > 50) return { text: 'Slow', className: 'text-red-400' };
  if (ms > 20) return { text: 'Fair', className: 'text-amber-400' };
  return { text: 'Good', className: 'text-accent' };
}

export function LatencyTile({ colo, className, style }: LatencyTileProps) {
  const [status, setStatus] = useState<Status>('measuring');
  const [samples, setSamples] = useState<number[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [jitterMs, setJitterMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPing = useCallback(async () => {
    setStatus('measuring');
    setSamples([]);
    setLatencyMs(null);
    setJitterMs(null);
    setError(null);

    try {
      const result = await measurePing(
        { pingCount: pingConfig.pingCount, pingWarmupCount: pingConfig.pingWarmupCount },
        (sampleMs) => setSamples((prev) => [...prev, sampleMs]),
      );
      setSamples(result.samples);
      setLatencyMs(result.latencyMs);
      setJitterMs(result.jitterMs);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ping failed');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    runPing();
  }, [runPing]);

  const maxVal = samples.length ? Math.max(...samples) : 1;
  const quality = latencyMs != null ? qualityLabel(latencyMs) : null;
  const footer = colo ? `${copy.footer} · via ${colo}` : copy.footer;

  return (
    <BentoTile
      title={copy.title}
      badge="PING"
      colSpan={5}
      mdColSpan={3}
      footer={footer}
      className={className}
      style={style}
    >
      <p className="text-[0.75rem] text-np-muted leading-relaxed mb-3">{copy.summary}</p>

      <div className="flex items-baseline justify-between gap-2 mb-2 min-h-[2rem]">
        {status === 'error' ? (
          <span className="text-[0.72rem] text-red-400">{error}</span>
        ) : status === 'measuring' && latencyMs == null ? (
          <span className="text-[0.72rem] text-np-faint">{copy.measuring}</span>
        ) : latencyMs != null ? (
          <>
            <span className="font-mono font-semibold text-np text-2xl tracking-tight">
              {formatMs(latencyMs)} ms
            </span>
            {quality && (
              <span className={cn('text-[0.72rem] font-medium', quality.className)}>
                {quality.text}
              </span>
            )}
          </>
        ) : null}
      </div>

      {jitterMs != null && status === 'done' && (
        <p className="text-[0.65rem] font-mono text-np-faint mb-2">
          Jitter:{' '}
          <span className="text-np-muted font-semibold">{formatMs(jitterMs)} ms</span>
        </p>
      )}

      <div
        className="h-20 bg-[var(--np-bg-base)]/80 border border-np rounded-xl flex items-end justify-between px-3 py-2 gap-0.5"
        aria-label={
          status === 'done' && latencyMs != null
            ? `Latency chart, average ${formatMs(latencyMs)} ms`
            : 'Latency measurement in progress'
        }
      >
        {samples.length === 0 ? (
          <div className="skeleton h-full w-full rounded" />
        ) : (
          samples.map((v, i) => (
            <div
              key={i}
              className={cn('flex-1 max-w-2 rounded-t transition-all duration-500', barColor(v))}
              style={{ height: `${(v / maxVal) * 100}%` }}
              title={`${formatMs(v)} ms`}
            />
          ))
        )}
      </div>

      <details className="mt-3 group">
        <summary className="text-[0.75rem] text-accent/80 hover:text-accent cursor-pointer list-none flex items-center gap-1.5 transition-colors [&::-webkit-details-marker]:hidden">
          <span className="text-[0.65rem] transition-transform group-open:rotate-90" aria-hidden>
            ▶
          </span>
          {copy.helpTitle}
        </summary>
        <dl className="mt-3 space-y-2.5 pl-3 border-l border-np">
          {copy.glossary.map((entry) => (
            <div key={entry.term}>
              <dt className="text-[0.75rem]">
                <span className="font-mono font-semibold text-np">{entry.term}</span>
                <span className="text-np-muted"> · {entry.label}</span>
              </dt>
              <dd className="text-[0.75rem] text-np-muted mt-0.5 leading-relaxed">
                {entry.description}
              </dd>
            </div>
          ))}
        </dl>
      </details>

      {status === 'error' && (
        <button
          type="button"
          onClick={runPing}
          className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-accent hover:text-accent/80 transition-colors border-0 bg-transparent cursor-pointer p-0"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </BentoTile>
  );
}
