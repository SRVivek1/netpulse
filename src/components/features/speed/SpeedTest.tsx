'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, RefreshCw, AlertTriangle, Gauge } from 'lucide-react';
import type { SpeedPresetId, SpeedTestResult } from '../../../types/api';
import { getSiteConfig } from '../../../lib/config';
import {
  formatMbps,
  formatMs,
  getSpeedCooldownRemainingMs,
  runSpeedTest,
  type SpeedPhase,
  type SpeedProgress,
} from '../../../lib/speed';
import { cn } from '../../../lib/utils';
import { Card, CardBody, CardHeader } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { DataRow } from '../../ui/DataRow';

const speedConfig = getSiteConfig().speedTest;
const PRESET_IDS = Object.keys(speedConfig.presets) as SpeedPresetId[];

function gaugeMaxMbps(preset: SpeedPresetId): number {
  switch (preset) {
    case 'gigabit':
      return 1200;
    case 'fast':
      return 600;
    default:
      return 150;
  }
}

function SpeedGauge({
  valueMbps,
  maxMbps,
  phase,
  label,
}: {
  valueMbps: number;
  maxMbps: number;
  phase: SpeedPhase | 'idle';
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.92;
    const radius = Math.min(w, h) * 0.72;
    const start = Math.PI;
    const end = 2 * Math.PI;

    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, end);
    ctx.stroke();

    const ratio = Math.min(valueMbps / maxMbps, 1);
    const activeEnd = start + ratio * Math.PI;
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#38bdf8');
    gradient.addColorStop(1, '#22d3ee');
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, start, activeEnd);
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 1.75rem Syne, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const display =
      phase === 'ping'
        ? '—'
        : valueMbps > 0
          ? formatMbps(valueMbps)
          : '0';
    ctx.fillText(display, cx, cy - radius * 0.35);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 0.7rem DM Sans, system-ui, sans-serif';
    ctx.fillText('Mbps', cx, cy - radius * 0.1);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 0.72rem DM Sans, system-ui, sans-serif';
    ctx.fillText(label, cx, cy + radius * 0.15);
  }, [valueMbps, maxMbps, phase, label]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-44"
      aria-label={`Speed gauge: ${valueMbps > 0 ? `${formatMbps(valueMbps)} Mbps` : 'waiting'}`}
    />
  );
}

function ResultSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="np-card p-4 space-y-2">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-7 w-24 rounded" />
        </div>
      ))}
    </div>
  );
}

export default function SpeedTest() {
  const [preset, setPreset] = useState<SpeedPresetId>(speedConfig.defaultPreset);
  const [phase, setPhase] = useState<SpeedPhase | 'idle'>('idle');
  const [gaugeMbps, setGaugeMbps] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);

  useEffect(() => {
    setCooldownMs(getSpeedCooldownRemainingMs());
    const id = window.setInterval(() => {
      setCooldownMs(getSpeedCooldownRemainingMs());
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, result]);

  const handleProgress = useCallback((progress: SpeedProgress) => {
    setPhase(progress.phase);
    if (progress.currentMbps != null) setGaugeMbps(progress.currentMbps);
    if (progress.phase === 'ping' && progress.pingSampleMs != null) {
      setGaugeMbps(0);
    }
  }, []);

  const handleRun = async () => {
    if (running || cooldownMs > 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setGaugeMbps(0);
    setPhase('ping');

    try {
      const data = await runSpeedTest(
        {
          assetsPath: speedConfig.assetsPath,
          downloadStreams: speedConfig.downloadStreams,
          uploadSizeMB: speedConfig.uploadSizeMB,
          pingCount: speedConfig.pingCount,
          pingWarmupCount: speedConfig.pingWarmupCount,
          presets: speedConfig.presets,
        },
        preset,
        handleProgress,
      );
      setResult(data);
      setGaugeMbps(data.download.mbps);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speed test failed');
      setPhase('idle');
    } finally {
      setRunning(false);
    }
  };

  const phaseLabel =
    phase === 'ping'
      ? 'Measuring latency…'
      : phase === 'download'
        ? 'Download test…'
        : phase === 'upload'
          ? 'Upload test…'
          : phase === 'done'
            ? 'Complete'
            : 'Ready';

  const cooldownSec = Math.ceil(cooldownMs / 1000);

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display font-bold text-2xl text-np tracking-tight">Speed Test</h1>
        <p className="text-np-muted text-[0.88rem] mt-1">
          Measure ping, download, and upload speed to the nearest Cloudflare edge. Download uses static
          assets (zero Worker CPU); upload streams through the edge Worker.
        </p>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Gauge size={16} className="text-accent" />
            Test preset
          </span>
          <Badge variant="slate">{speedConfig.downloadStreams} parallel streams</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESET_IDS.map((id) => {
              const p = speedConfig.presets[id];
              const totalMb = p.chunkSizeMB * speedConfig.downloadStreams;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={running}
                  onClick={() => setPreset(id)}
                  className={cn(
                    'flex-1 min-w-[7rem] rounded-xl border px-3 py-2.5 text-left transition-colors',
                    preset === id
                      ? 'border-accent/50 bg-accent/10 text-np'
                      : 'border-np bg-hover text-np-muted hover:text-np',
                    running && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className="block text-[0.82rem] font-medium">{p.label}</span>
                  <span className="block text-[0.7rem] text-np-faint mt-0.5">
                    {totalMb} MB · {p.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="np-card bg-[var(--np-bg-base)]/60 border border-np rounded-xl px-2 pt-2">
            <SpeedGauge
              valueMbps={gaugeMbps}
              maxMbps={gaugeMaxMbps(preset)}
              phase={phase}
              label={phaseLabel}
            />
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={running || cooldownMs > 0}
            className="cta-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
          >
            {running ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Running test…
              </>
            ) : cooldownMs > 0 ? (
              `Wait ${cooldownSec}s before next test`
            ) : (
              <>
                <Zap size={14} />
                Start speed test
              </>
            )}
          </button>
        </CardBody>
      </Card>

      {running && !result && <ResultSkeleton />}

      {error && (
        <div className="np-card p-4 flex items-start gap-3 border border-red-400/20 bg-red-400/5">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} strokeWidth={1.5} />
          <div>
            <p className="text-np font-medium text-[0.88rem]">Test failed</p>
            <p className="font-mono text-[0.75rem] text-np-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && !running && (
        <div className="space-y-4 animate-fade-up">
          <div className="flex flex-wrap gap-2">
            <Badge variant="blue">{speedConfig.presets[result.preset].label} preset</Badge>
            <Badge variant="green">Complete</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader>Ping</CardHeader>
              <CardBody>
                <DataRow label="Latency" value={`${formatMs(result.ping.latencyMs)} ms`} mono />
                <DataRow label="Jitter" value={`${formatMs(result.ping.jitterMs)} ms`} mono />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Download</CardHeader>
              <CardBody>
                <DataRow label="Speed" value={`${formatMbps(result.download.mbps)} Mbps`} mono />
                <DataRow
                  label="Transferred"
                  value={`${(result.download.bytesTransferred / (1024 * 1024)).toFixed(1)} MB`}
                  mono
                />
              </CardBody>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardHeader>Upload</CardHeader>
              <CardBody>
                <DataRow label="Speed" value={`${formatMbps(result.upload.mbps)} Mbps`} mono />
                <DataRow
                  label="Transferred"
                  value={`${(result.upload.bytesTransferred / (1024 * 1024)).toFixed(1)} MB`}
                  mono
                />
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
