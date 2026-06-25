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
      return 'speed-gauge-hub__phase--ping';
    case 'download':
      return 'speed-gauge-hub__phase--download';
    case 'upload':
      return 'speed-gauge-hub__phase--upload';
    case 'done':
      return 'speed-gauge-hub__phase--done';
    default:
      return 'speed-gauge-hub__phase--idle';
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
  const valueSizeClass = displayValue.length >= 4 ? 'text-4xl' : 'text-5xl';

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
          'speed-gauge-hub absolute inset-8 rounded-full flex flex-col justify-center items-center text-center group',
        )}
      >
        {!showIdleOverlay && (
          <div className="flex flex-col items-center px-3">
            <p className={cn('speed-gauge-hub__phase mb-1.5', phaseStatusClass(phase))}>
              {phaseLabel}
            </p>

            <div className="flex items-baseline justify-center select-none min-h-[3.25rem]">
              <span className={cn('speed-gauge-hub__value', valueSizeClass)}>
                {displayValue}
              </span>
            </div>

            <p className="speed-gauge-hub__unit mt-1.5">{resolvedUnitLabel}</p>
          </div>
        )}

        {showRetestAction && (
          <button
            type="button"
            onClick={onStart}
            disabled={goDisabled}
            className={cn(
              'speed-gauge-hub__cta mt-3 px-5 py-2 rounded-full flex flex-col items-center justify-center transition-all duration-300',
              goDisabled
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer hover:scale-105 speed-glow-teal',
            )}
            aria-label="Retest speed"
          >
            {goDisabled ? (
              <>
                <span className="text-sm font-black tracking-widest font-mono">
                  {cooldownSec}s
                </span>
                <span className="speed-gauge-hub__cta-sub mt-0.5">Cooldown</span>
              </>
            ) : (
              <>
                <span className="text-sm font-black tracking-widest font-mono">TEST</span>
                <span className="speed-gauge-hub__cta-sub mt-0.5">Retest</span>
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
              'speed-gauge-hub__cta speed-gauge-hub__cta--overlay absolute inset-0 rounded-full flex flex-col items-center justify-center transition-all duration-300',
              goDisabled
                ? 'opacity-60 cursor-not-allowed'
                : 'cursor-pointer group-hover:scale-[1.02] speed-glow-teal',
            )}
            aria-label="Start speed test"
          >
            {goDisabled ? (
              <>
                <span className="text-xl font-black tracking-widest font-mono">
                  {cooldownSec}s
                </span>
                <span className="speed-gauge-hub__cta-sub mt-1">Cooldown</span>
              </>
            ) : (
              <>
                <span
                  className={cn(
                    'speed-gauge-hub__phase mb-2',
                    phaseStatusClass(phase),
                  )}
                >
                  {phaseLabel}
                </span>
                <span className="text-4xl font-black tracking-widest font-mono">GO</span>
                <span className="speed-gauge-hub__cta-sub mt-2">Start test</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
