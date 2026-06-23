'use client';
import { useId, useMemo } from 'react';
import { formatMbps, type SpeedPhase } from '../../../lib/speed';
import { cn } from '../../../lib/utils';
import { ARC, arcRatioToDashOffset, mbpsToRatio, pingMsToRatio } from './gaugeScale';

export interface SpeedGaugeProps {
  value: number;
  unit: 'Mbps' | 'ms';
  unitLabel?: string;
  phase: SpeedPhase | 'idle';
  phaseLabel: string;
  strokeVariant: 'cyan' | 'fuchsia';
  running: boolean;
  cooldownMs: number;
  hasResult: boolean;
  onStart: () => void;
  className?: string;
}

function phaseStatusClass(phase: SpeedPhase | 'idle'): string {
  switch (phase) {
    case 'ping':
      return 'text-blue-400';
    case 'download':
      return 'text-cyan-400';
    case 'upload':
      return 'text-fuchsia-400';
    case 'done':
      return 'text-emerald-400';
    default:
      return 'text-np-muted';
  }
}

export function SpeedGauge({
  value,
  unit,
  unitLabel,
  phase,
  phaseLabel,
  strokeVariant,
  running,
  cooldownMs,
  hasResult,
  onStart,
  className,
}: SpeedGaugeProps) {
  const cyanGradId = useId();
  const fuchsiaGradId = useId();

  const ratio = useMemo(() => {
    if (unit === 'ms') return pingMsToRatio(value);
    return mbpsToRatio(value);
  }, [unit, value]);

  const dashOffset = arcRatioToDashOffset(ratio);

  const displayValue = useMemo(() => {
    if (phase === 'ping' && value <= 0) return '—';
    if (unit === 'ms') return value > 0 ? String(Math.round(value)) : '—';
    if (value <= 0) return '0';
    if (phase === 'done') return formatMbps(value);
    return String(Math.floor(value));
  }, [phase, unit, value]);

  const resolvedUnitLabel = unitLabel ?? unit;
  const cooldownSec = Math.ceil(cooldownMs / 1000);
  const showGoButton = !running;
  const goDisabled = cooldownMs > 0;
  const showIdleOverlay = showGoButton && !hasResult;
  const showRetestAction = showGoButton && hasResult;

  const ariaLabel =
    value > 0
      ? `${displayValue} ${resolvedUnitLabel}, ${phaseLabel}`
      : `Speed gauge waiting, ${phaseLabel}`;

  return (
    <div className={cn('relative flex items-center justify-center w-80 h-80 my-2 mx-auto', className)}>
      <svg
        className="w-full h-full -rotate-45"
        viewBox="0 0 200 200"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={cyanGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id={fuchsiaGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        <circle
          cx="100"
          cy="100"
          r={85}
          fill="none"
          stroke="color-mix(in srgb, var(--np-bg-base) 85%, black)"
          strokeWidth="6"
          strokeDasharray={ARC.trackDasharray}
          strokeLinecap="round"
        />

        <circle
          cx="100"
          cy="100"
          r={85}
          fill="none"
          stroke={`url(#${strokeVariant === 'fuchsia' ? fuchsiaGradId : cyanGradId})`}
          strokeWidth="8"
          strokeDasharray={ARC.progressDasharray}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className="speed-gauge-progress"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
        />
      </svg>

      <div
        className={cn(
          'absolute inset-8 rounded-full flex flex-col justify-center items-center text-center shadow-inner group',
          'bg-[color-mix(in_srgb,var(--np-bg-base)_80%,black)]',
          'border border-np backdrop-blur-xl',
        )}
      >
        <p
          className={cn(
            'text-[10px] font-mono tracking-widest uppercase mb-1',
            phaseStatusClass(phase),
          )}
        >
          {phaseLabel}
        </p>

        <div className="flex items-baseline justify-center select-none min-h-[4rem] px-2">
          <span
            className={cn(
              'font-extrabold tracking-tighter text-np font-mono tabular-nums leading-none',
              displayValue.length >= 4 ? 'text-4xl' : 'text-5xl',
            )}
          >
            {displayValue}
          </span>
        </div>

        <p className="text-xs font-mono text-np-faint uppercase mt-1 px-2">{resolvedUnitLabel}</p>

        {showRetestAction && (
          <button
            type="button"
            onClick={onStart}
            disabled={goDisabled}
            className={cn(
              'mt-3 px-4 py-2 rounded-full flex flex-col items-center justify-center transition-all duration-300',
              'bg-gradient-to-tr from-cyan-500/10 to-indigo-500/10',
              'hover:from-cyan-500/20 hover:to-indigo-500/20 border border-cyan-500/30',
              'speed-glow-teal',
              goDisabled
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer hover:scale-105',
            )}
            aria-label="Retest speed"
          >
            {goDisabled ? (
              <>
                <span className="text-sm font-black tracking-widest text-np font-mono">
                  {cooldownSec}s
                </span>
                <span className="text-[9px] font-mono tracking-widest text-cyan-400 uppercase mt-0.5 opacity-80">
                  Cooldown
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-black tracking-widest text-np font-mono">
                  TEST
                </span>
                <span className="text-[9px] font-mono tracking-widest text-cyan-400 uppercase mt-0.5 opacity-80">
                  Retest Stack Pipeline
                </span>
              </>
            )}
          </button>
        )}

        {showIdleOverlay && (
          <button
            type="button"
            onClick={onStart}
            disabled={goDisabled}
            className={cn(
              'absolute inset-0 rounded-full flex flex-col items-center justify-center transition-all duration-300 cursor-pointer',
              'bg-gradient-to-tr from-cyan-500/10 to-indigo-500/10',
              'hover:from-cyan-500/20 hover:to-indigo-500/20 border border-cyan-500/30',
              'group-hover:scale-105 speed-glow-teal',
              goDisabled && 'opacity-60 cursor-not-allowed hover:scale-100',
            )}
            aria-label="Start speed test"
          >
            {goDisabled ? (
              <>
                <span className="text-xl font-black tracking-widest text-np font-mono">
                  {cooldownSec}s
                </span>
                <span className="text-[9px] font-mono tracking-widest text-cyan-400 uppercase mt-1 opacity-80">
                  Cooldown
                </span>
              </>
            ) : (
              <>
                <span className="text-3xl font-black tracking-widest text-np font-mono drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                  GO
                </span>
                <span className="text-[9px] font-mono tracking-widest text-cyan-400 uppercase mt-1 opacity-80">
                  Initialize Stack
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
