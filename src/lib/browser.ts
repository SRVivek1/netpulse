export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export interface ParsedUserAgent {
  browser: string;
  os: string;
  deviceType: DeviceType;
}

export interface WebGLInfo {
  vendor: string;
  renderer: string;
  version: string;
}

export interface BatteryInfo {
  level: number | null;
  charging: boolean | null;
}

export interface BrowserCapabilities {
  webAssembly: boolean;
  webRtc: boolean;
  serviceWorker: boolean;
  indexedDb: boolean;
  pdfViewer: boolean;
  webGpu: boolean;
  touchSupport: boolean;
  cookiesEnabled: boolean;
  doNotTrack: string | null;
}

export interface BrowserFingerprint {
  userAgent: ParsedUserAgent;
  platform: string;
  language: string;
  languages: string[];
  cores: number | null;
  memory: number | null;
  screenResolution: string;
  colorDepth: number;
  pixelRatio: number;
  orientation: string | null;
  timezone: string;
  connectionType: string | null;
  connectionRtt: number | null;
  connectionDownlink: number | null;
  saveData: boolean;
  webgl: WebGLInfo | null;
  battery: BatteryInfo | null;
  capabilities: BrowserCapabilities;
}

/** Lightweight UA parse without external dependencies. */
export function parseUserAgent(ua: string): ParsedUserAgent {
  let browser = 'Unknown browser';
  if (/Edg\//.test(ua)) browser = `Edge ${ua.match(/Edg\/([\d.]+)/)?.[1] ?? ''}`.trim();
  else if (/OPR\//.test(ua)) browser = `Opera ${ua.match(/OPR\/([\d.]+)/)?.[1] ?? ''}`.trim();
  else if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''}`.trim();
  } else if (/Firefox\//.test(ua)) browser = `Firefox ${ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ''}`.trim();
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) {
    browser = `Safari ${ua.match(/Version\/([\d.]+)/)?.[1] ?? ''}`.trim();
  }

  let os = 'Unknown OS';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ''}`.trim();
  else if (/iPhone|iPad/.test(ua)) os = 'iOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  else if (/CrOS/.test(ua)) os = 'Chrome OS';

  let deviceType: DeviceType = 'desktop';
  if (/iPad|Tablet/i.test(ua)) deviceType = 'tablet';
  else if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'mobile';

  return { browser, os, deviceType };
}

export function getWebGLInfo(): WebGLInfo | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return null;

    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debug
      ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) as string
      : gl.getParameter(gl.VENDOR) as string;
    const renderer = debug
      ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string
      : gl.getParameter(gl.RENDERER) as string;

    return {
      vendor: String(vendor),
      renderer: String(renderer),
      version: String(gl.getParameter(gl.VERSION)),
    };
  } catch {
    return null;
  }
}

export async function getBatteryInfo(): Promise<BatteryInfo | null> {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    getBattery?: () => Promise<{ level: number; charging: boolean }>;
  };
  if (!nav.getBattery) return null;
  try {
    const bat = await nav.getBattery();
    return {
      level: Math.round(bat.level * 100),
      charging: bat.charging,
    };
  } catch {
    return null;
  }
}

export function getBrowserCapabilities(): BrowserCapabilities {
  return {
    webAssembly: typeof WebAssembly !== 'undefined',
    webRtc: typeof RTCPeerConnection !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator,
    indexedDb: typeof indexedDB !== 'undefined',
    pdfViewer: typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true,
    webGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
    touchSupport: navigator.maxTouchPoints > 0,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
  };
}

export async function collectBrowserFingerprint(): Promise<BrowserFingerprint> {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean };
    mozConnection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean };
    webkitConnection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean };
    deviceMemory?: number;
    userAgentData?: { platform?: string };
  };

  const conn = nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
  const [battery, webgl] = await Promise.all([getBatteryInfo(), Promise.resolve(getWebGLInfo())]);

  return {
    userAgent: parseUserAgent(navigator.userAgent),
    platform: nav.userAgentData?.platform ?? navigator.platform ?? '—',
    language: navigator.language || '—',
    languages: [...(navigator.languages ?? [])],
    cores: navigator.hardwareConcurrency ?? null,
    memory: nav.deviceMemory ?? null,
    screenResolution: `${screen.width} × ${screen.height}`,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio,
    orientation: screen.orientation?.type ?? null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    connectionType: conn?.effectiveType ?? null,
    connectionRtt: conn?.rtt ?? null,
    connectionDownlink: conn?.downlink ?? null,
    saveData: conn?.saveData ?? false,
    webgl,
    battery,
    capabilities: getBrowserCapabilities(),
  };
}
