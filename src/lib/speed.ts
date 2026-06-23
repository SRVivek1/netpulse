import type { SiteConfig } from '../types/config';
import type { PingResult, SpeedPresetId, SpeedTestResult, TransferResult } from '../types/api';

export type SpeedPhase = 'ping' | 'download' | 'upload' | 'done';

export interface SpeedProgress {
  phase: SpeedPhase;
  /** Instantaneous Mbps during download/upload */
  currentMbps?: number;
  /** Latest ping sample in ms */
  pingSampleMs?: number;
}

export interface SpeedTestConfig {
  assetsPath: string;
  downloadStreams: number;
  uploadSizeMB: number;
  pingCount: number;
  pingWarmupCount: number;
  presets: SiteConfig['speedTest']['presets'];
}

export interface AutoPresetConfig {
  probeSizeMB: number;
  thresholdsMbps: { fast: number; gigabit: number };
  reuseLastResultMs: number;
}

export type AutoPresetSource = 'last-result' | 'probe' | 'network-api' | 'tcp-rtt' | 'fallback';

export interface AutoPresetResult {
  preset: SpeedPresetId;
  source: AutoPresetSource;
  estimatedMbps?: number;
}

interface LastSpeedResult {
  downloadMbps: number;
  preset: SpeedPresetId;
  at: number;
}

const COOLDOWN_MS = 30_000;
const COOLDOWN_KEY = 'np-speed:last-run';
const LAST_RESULT_KEY = 'np-speed:last-result';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function meanAbsoluteDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + Math.abs(v - mean), 0) / values.length;
}

function bytesToMbps(bytes: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  return (bytes * 8) / (durationMs / 1000) / 1_000_000;
}

/** Browsers cap crypto.getRandomValues() at 65536 bytes per call. */
const CRYPTO_RANDOM_CHUNK = 65_536;

function fillRandomBytes(buffer: Uint8Array): void {
  for (let offset = 0; offset < buffer.length; offset += CRYPTO_RANDOM_CHUNK) {
    const end = Math.min(offset + CRYPTO_RANDOM_CHUNK, buffer.length);
    crypto.getRandomValues(buffer.subarray(offset, end));
  }
}

export function getSpeedCooldownRemainingMs(): number {
  try {
    const raw = sessionStorage.getItem(COOLDOWN_KEY);
    if (!raw) return 0;
    const last = Number(raw);
    if (Number.isNaN(last)) return 0;
    return Math.max(0, COOLDOWN_MS - (Date.now() - last));
  } catch {
    return 0;
  }
}

export function markSpeedTestCompleted(): void {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable
  }
}

export function saveLastSpeedResult(downloadMbps: number, preset: SpeedPresetId): void {
  try {
    const payload: LastSpeedResult = { downloadMbps, preset, at: Date.now() };
    sessionStorage.setItem(LAST_RESULT_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage unavailable
  }
}

export function getLastSpeedResult(): LastSpeedResult | null {
  try {
    const raw = sessionStorage.getItem(LAST_RESULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastSpeedResult;
    if (
      typeof parsed.downloadMbps !== 'number' ||
      typeof parsed.at !== 'number' ||
      !parsed.preset
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getNetworkDownlinkHint(): { downlink: number | null; saveData: boolean } {
  if (typeof navigator === 'undefined') {
    return { downlink: null, saveData: false };
  }
  const nav = navigator as Navigator & {
    connection?: { downlink?: number; saveData?: boolean };
    mozConnection?: { downlink?: number; saveData?: boolean };
    webkitConnection?: { downlink?: number; saveData?: boolean };
  };
  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
  const downlink = conn?.downlink;
  return {
    downlink: typeof downlink === 'number' && downlink > 0 ? downlink : null,
    saveData: conn?.saveData ?? false,
  };
}

export function presetFromMbps(
  mbps: number,
  thresholds: { fast: number; gigabit: number },
): SpeedPresetId {
  if (mbps >= thresholds.gigabit) return 'gigabit';
  if (mbps >= thresholds.fast) return 'fast';
  return 'standard';
}

export async function probeDownloadMbps(
  config: Pick<SpeedTestConfig, 'assetsPath'>,
  probeSizeMB: number,
): Promise<number> {
  const byteLimit = probeSizeMB * 1024 * 1024;
  const bust = crypto.randomUUID();
  const url = `${config.assetsPath}/chunk-1.bin?r=${bust}`;
  const start = performance.now();
  const received = await fetchChunkWithProgress(url, byteLimit, () => {});
  const durationMs = performance.now() - start;
  if (received < byteLimit * 0.9) {
    throw new Error('Probe download incomplete');
  }
  return bytesToMbps(received, durationMs);
}

export async function resolveAutoPreset(
  config: SpeedTestConfig,
  autoPreset: AutoPresetConfig,
  hints?: { clientTcpRtt?: number | null },
): Promise<AutoPresetResult> {
  const { thresholdsMbps } = autoPreset;
  const { saveData, downlink } = getNetworkDownlinkHint();

  if (saveData) {
    return { preset: 'standard', source: 'fallback', estimatedMbps: downlink ?? undefined };
  }

  const last = getLastSpeedResult();
  if (last && Date.now() - last.at < autoPreset.reuseLastResultMs) {
    return {
      preset: presetFromMbps(last.downloadMbps, thresholdsMbps),
      source: 'last-result',
      estimatedMbps: last.downloadMbps,
    };
  }

  try {
    const mbps = await probeDownloadMbps(config, autoPreset.probeSizeMB);
    return {
      preset: presetFromMbps(mbps, thresholdsMbps),
      source: 'probe',
      estimatedMbps: mbps,
    };
  } catch {
    // probe failed — try weaker hints
  }

  if (downlink != null) {
    return {
      preset: presetFromMbps(downlink, thresholdsMbps),
      source: 'network-api',
      estimatedMbps: downlink,
    };
  }

  const rtt = hints?.clientTcpRtt;
  if (typeof rtt === 'number' && rtt > 0) {
    const estimatedMbps = rtt < 30 ? 150 : rtt < 80 ? 50 : 20;
    return {
      preset: presetFromMbps(estimatedMbps, thresholdsMbps),
      source: 'tcp-rtt',
      estimatedMbps,
    };
  }

  return { preset: 'standard', source: 'fallback' };
}

export async function measurePing(
  config: Pick<SpeedTestConfig, 'pingCount' | 'pingWarmupCount'>,
  onProgress?: (sampleMs: number) => void,
): Promise<PingResult> {
  const samples: number[] = [];

  for (let i = 0; i < config.pingCount; i++) {
    const start = performance.now();
    const res = await fetch('/api/ping', { method: 'HEAD', cache: 'no-store' });
    if (!res.ok) throw new Error(`Ping failed (${res.status})`);
    const rtt = performance.now() - start;

    if (i >= config.pingWarmupCount) {
      samples.push(rtt);
      onProgress?.(rtt);
    }

    if (i < config.pingCount - 1) await sleep(50);
  }

  const latencyMs = samples.reduce((a, b) => a + b, 0) / samples.length;
  return {
    latencyMs,
    jitterMs: meanAbsoluteDeviation(samples),
    samples,
  };
}

async function fetchChunkWithProgress(
  url: string,
  byteLimit: number,
  onBytes: (delta: number) => void,
): Promise<number> {
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Range: `bytes=0-${byteLimit - 1}` },
  });

  if (!res.ok && res.status !== 206) {
    throw new Error(`Download failed (${res.status})`);
  }

  const body = res.body;
  if (!body) throw new Error('Download stream unavailable');

  const reader = body.getReader();
  let received = 0;

  while (received < byteLimit) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    onBytes(value.byteLength);
  }

  try {
    await reader.cancel();
  } catch {
    // ignore cancel errors
  }

  return received;
}

export async function measureDownload(
  config: SpeedTestConfig,
  preset: SpeedPresetId,
  onProgress?: (progress: SpeedProgress) => void,
): Promise<TransferResult> {
  const presetConfig = config.presets[preset];
  const chunkBytes = presetConfig.chunkSizeMB * 1024 * 1024;
  const totalExpected = chunkBytes * config.downloadStreams;
  const bust = crypto.randomUUID();
  let totalReceived = 0;
  const start = performance.now();

  onProgress?.({ phase: 'download', currentMbps: 0 });

  const streams = Array.from({ length: config.downloadStreams }, (_, i) => {
    const url = `${config.assetsPath}/chunk-${i + 1}.bin?r=${bust}`;
    return fetchChunkWithProgress(url, chunkBytes, (delta) => {
      totalReceived += delta;
      const elapsed = performance.now() - start;
      onProgress?.({
        phase: 'download',
        currentMbps: bytesToMbps(totalReceived, elapsed),
      });
    });
  });

  const receivedPerStream = await Promise.all(streams);
  const bytesTransferred = receivedPerStream.reduce((a, b) => a + b, 0);
  const durationMs = performance.now() - start;

  if (bytesTransferred < totalExpected * 0.9) {
    throw new Error('Download incomplete — speed test assets may be missing. Run npm run build.');
  }

  return {
    mbps: bytesToMbps(bytesTransferred, durationMs),
    bytesTransferred,
    durationMs,
  };
}

export async function measureUpload(
  uploadSizeMB: number,
  onProgress?: (progress: SpeedProgress) => void,
): Promise<TransferResult> {
  const bytes = uploadSizeMB * 1024 * 1024;
  const data = new Uint8Array(bytes);
  fillRandomBytes(data);

  onProgress?.({ phase: 'upload', currentMbps: 0 });

  const start = performance.now();
  const res = await fetch('/api/upload', {
    method: 'POST',
    body: data,
    headers: { 'Content-Type': 'application/octet-stream' },
    cache: 'no-store',
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Upload failed (${res.status})`);
  }

  const durationMs = performance.now() - start;
  const mbps = bytesToMbps(bytes, durationMs);
  onProgress?.({ phase: 'upload', currentMbps: mbps });

  return { mbps, bytesTransferred: bytes, durationMs };
}

export async function runSpeedTest(
  config: SpeedTestConfig,
  preset: SpeedPresetId,
  onProgress?: (progress: SpeedProgress) => void,
): Promise<SpeedTestResult> {
  onProgress?.({ phase: 'ping' });
  const ping = await measurePing(config, (sampleMs) => {
    onProgress?.({ phase: 'ping', pingSampleMs: sampleMs });
  });

  const download = await measureDownload(config, preset, onProgress);
  const upload = await measureUpload(config.uploadSizeMB, onProgress);

  onProgress?.({ phase: 'done' });
  markSpeedTestCompleted();
  saveLastSpeedResult(download.mbps, preset);

  return {
    ping,
    download,
    upload,
    preset,
    completedAt: new Date().toISOString(),
  };
}

export function formatMbps(mbps: number): string {
  if (mbps >= 100) return mbps.toFixed(0);
  if (mbps >= 10) return mbps.toFixed(1);
  return mbps.toFixed(2);
}

export function formatMs(ms: number): string {
  return ms < 10 ? ms.toFixed(1) : Math.round(ms).toString();
}
