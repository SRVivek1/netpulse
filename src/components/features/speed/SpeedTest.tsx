'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { IpData, SpeedTestResult } from '../../../types/api';
import { getSiteConfig } from '../../../lib/config';
import {
  getSpeedCooldownRemainingMs,
  meanAbsoluteDeviation,
  resolveAutoPreset,
  runSpeedTest,
  type SpeedPhase,
  type SpeedProgress,
} from '../../../lib/speed';
import { fetchWithTimeout } from '../../../lib/utils';
import { SpeedGauge } from './SpeedGauge';
import { SpeedMetricsRow } from './SpeedMetricsRow';
import { SpeedConnectionBar } from './SpeedConnectionBar';

const speedConfig = getSiteConfig().speedTest;

type UiPhase = SpeedPhase | 'idle' | 'detecting';

function templatePhaseLabel(phase: UiPhase): string {
  switch (phase) {
    case 'detecting':
      return 'Detecting connection…';
    case 'ping':
      return 'Pinging Node Hub…';
    case 'download':
      return 'Testing Download RX…';
    case 'upload':
      return 'Testing Upload TX…';
    case 'done':
      return 'Test Complete';
    default:
      return 'Network Idle';
  }
}

export default function SpeedTest() {
  const [phase, setPhase] = useState<UiPhase>('idle');
  const [gaugeMbps, setGaugeMbps] = useState(0);
  const [livePingMs, setLivePingMs] = useState<number | null>(null);
  const [liveJitterMs, setLiveJitterMs] = useState<number | null>(null);
  const [liveUploadMbps, setLiveUploadMbps] = useState<number | null>(null);
  const [liveDownloadMbps, setLiveDownloadMbps] = useState<number | null>(null);
  const [pingSamples, setPingSamples] = useState<number[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [cooldownMs, setCooldownMs] = useState(0);
  const [edgeColo, setEdgeColo] = useState<string | null>(null);
  const [clientTcpRtt, setClientTcpRtt] = useState<number | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [asn, setAsn] = useState<number | null>(null);
  const [asnOrg, setAsnOrg] = useState<string | null>(null);

  useEffect(() => {
    setCooldownMs(getSpeedCooldownRemainingMs());
    const id = window.setInterval(() => {
      setCooldownMs(getSpeedCooldownRemainingMs());
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, result]);

  useEffect(() => {
    let cancelled = false;
    fetchWithTimeout('/api/ip', {}, 10_000)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: IpData | null) => {
        if (cancelled || !data) return;
        if (data.colo) setEdgeColo(data.colo);
        if (data.clientTcpRtt != null) setClientTcpRtt(data.clientTcpRtt);
        if (data.ip) setIp(data.ip);
        if (data.asn != null) setAsn(data.asn);
        if (data.asnOrg) setAsnOrg(data.asnOrg);
      })
      .catch(() => {
        // edge metadata unavailable in local dev
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProgress = useCallback((progress: SpeedProgress) => {
    setPhase(progress.phase);

    if (progress.currentMbps != null) {
      setGaugeMbps(progress.currentMbps);
      if (progress.phase === 'download') {
        setLiveDownloadMbps(progress.currentMbps);
      }
      if (progress.phase === 'upload') {
        setLiveUploadMbps(progress.currentMbps);
      }
    }

    if (progress.phase === 'ping' && progress.pingSampleMs != null) {
      setGaugeMbps(0);
      setPingSamples((prev) => {
        const next = [...prev, progress.pingSampleMs!];
        const avg = next.reduce((a, b) => a + b, 0) / next.length;
        setLivePingMs(avg);
        setLiveJitterMs(meanAbsoluteDeviation(next));
        return next;
      });
    }
  }, []);

  const testConfig = useMemo(
    () => ({
      assetsPath: speedConfig.assetsPath,
      downloadStreams: speedConfig.downloadStreams,
      uploadSizeMB: speedConfig.uploadSizeMB,
      pingCount: speedConfig.pingCount,
      pingWarmupCount: speedConfig.pingWarmupCount,
      presets: speedConfig.presets,
    }),
    [],
  );

  const handleRun = async () => {
    if (running || cooldownMs > 0) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setGaugeMbps(0);
    setLivePingMs(null);
    setLiveJitterMs(null);
    setLiveUploadMbps(null);
    setLiveDownloadMbps(null);
    setPingSamples([]);
    setPhase('detecting');

    try {
      const auto = await resolveAutoPreset(testConfig, speedConfig.autoPreset, {
        clientTcpRtt,
      });
      setPhase('ping');

      const data = await runSpeedTest(testConfig, auto.preset, handleProgress);
      setResult(data);
      setGaugeMbps(data.download.mbps);
      setLivePingMs(data.ping.latencyMs);
      setLiveJitterMs(data.ping.jitterMs);
      setLiveUploadMbps(data.upload.mbps);
      setLiveDownloadMbps(data.download.mbps);
      setPhase('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speed test failed');
      setPhase('idle');
    } finally {
      setRunning(false);
    }
  };

  const gaugeUnit: 'Mbps' | 'ms' = phase === 'ping' ? 'ms' : 'Mbps';
  const gaugeUnitLabel = phase === 'done' ? 'Peak download · Mbps' : undefined;

  const gaugeValue = useMemo(() => {
    if (phase === 'ping') return livePingMs ?? 0;
    if (phase === 'upload') return liveUploadMbps ?? gaugeMbps;
    if (phase === 'done') return result?.download.mbps ?? gaugeMbps;
    return gaugeMbps;
  }, [phase, livePingMs, liveUploadMbps, gaugeMbps, result]);

  const metrics = useMemo(
    () => ({
      pingMs: result?.ping.latencyMs ?? livePingMs,
      jitterMs: result?.ping.jitterMs ?? liveJitterMs,
      downloadMbps: result?.download.mbps ?? liveDownloadMbps,
      uploadMbps: result?.upload.mbps ?? liveUploadMbps,
    }),
    [result, livePingMs, liveJitterMs, liveUploadMbps, liveDownloadMbps],
  );

  const gaugePhase: SpeedPhase | 'idle' =
    phase === 'detecting' ? 'idle' : phase;

  const strokeVariant = phase === 'upload' ? 'fuchsia' : 'cyan';
  const hasResult = result != null && phase === 'done';

  return (
    <div className="max-w-4xl mx-auto flex flex-col justify-center items-center animate-fade-up py-4">
      <SpeedMetricsRow metrics={metrics} phase={gaugePhase} />

      <SpeedGauge
        value={gaugeValue}
        unit={gaugeUnit}
        unitLabel={gaugeUnitLabel}
        phase={gaugePhase}
        phaseLabel={templatePhaseLabel(phase)}
        strokeVariant={strokeVariant}
        running={running}
        cooldownMs={cooldownMs}
        hasResult={hasResult}
        onStart={handleRun}
      />

      <SpeedConnectionBar
        connection={{ ip, asn, asnOrg, edgeColo }}
        className="w-full"
      />

      {error && (
        <div className="w-full mt-4 np-card p-4 flex items-start gap-3 border border-red-400/20 bg-red-400/5">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} strokeWidth={1.5} />
          <div>
            <p className="text-np font-medium text-[0.88rem]">Test failed</p>
            <p className="font-mono text-[0.75rem] text-np-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
