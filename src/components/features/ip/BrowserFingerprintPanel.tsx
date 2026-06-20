import type { BrowserFingerprint } from '../../../lib/browser';
import { Badge } from '../../ui/Badge';

function CapBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[0.65rem] font-medium border ${
        enabled
          ? 'bg-emerald-400/10 text-emerald-400/90 border-emerald-400/20'
          : 'bg-[var(--np-overlay)] text-np-faint border-np'
      }`}
    >
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-np last:border-0">
      <span className="text-[0.76rem] text-np-faint shrink-0">{label}</span>
      <span className="text-[0.78rem] font-mono text-np text-right">{value ?? '—'}</span>
    </div>
  );
}

interface Props {
  fingerprint: BrowserFingerprint;
  ipTimezone: string | null;
}

export function BrowserFingerprintPanel({ fingerprint, ipTimezone }: Props) {
  const { userAgent: ua, capabilities: cap, webgl, battery } = fingerprint;
  const tzMismatch = ipTimezone && fingerprint.timezone !== ipTimezone;

  return (
    <div>
      <div className="px-4 py-1">
        <Row label="Browser" value={ua.browser} />
        <Row label="OS" value={ua.os} />
        <Row
          label="Device"
          value={
            <Badge variant="slate" className="capitalize">
              {ua.deviceType}
            </Badge>
          }
        />
        <Row label="Platform" value={fingerprint.platform} />
        <Row label="Languages" value={fingerprint.languages.join(', ') || fingerprint.language} />
        <Row label="Screen" value={`${fingerprint.screenResolution} @${fingerprint.pixelRatio}x`} />
        <Row label="CPU cores" value={fingerprint.cores != null ? String(fingerprint.cores) : null} />
        <Row label="Memory" value={fingerprint.memory != null ? `${fingerprint.memory} GB` : null} />
        <Row label="Browser TZ" value={fingerprint.timezone} />
        {tzMismatch && (
          <Row label="IP TZ" value={`${ipTimezone} (mismatch)`} />
        )}
        <Row label="Network" value={fingerprint.connectionType} />
        <Row
          label="Est. downlink"
          value={fingerprint.connectionDownlink != null ? `${fingerprint.connectionDownlink} Mbps` : null}
        />
      </div>

      {webgl && (
        <>
          <div className="px-4 py-3 border-t border-np">
            <p className="text-[0.68rem] uppercase tracking-wider text-np-faint font-semibold">WebGL / GPU</p>
          </div>
          <div className="px-4 py-1">
            <Row label="Vendor" value={webgl.vendor} />
            <Row label="Renderer" value={webgl.renderer} />
            <Row label="Version" value={webgl.version} />
          </div>
        </>
      )}

      {battery && (
        <div className="px-4 py-1 border-t border-np">
          <Row
            label="Battery"
            value={`${battery.level ?? '—'}%${battery.charging ? ' (charging)' : ''}`}
          />
        </div>
      )}

      <div className="px-4 py-3 border-t border-np">
        <p className="text-[0.68rem] uppercase tracking-wider text-np-faint font-semibold mb-2.5">
          Browser capabilities
        </p>
        <div className="flex flex-wrap gap-1.5">
          <CapBadge enabled={cap.webAssembly} label="WebAssembly" />
          <CapBadge enabled={cap.webRtc} label="WebRTC" />
          <CapBadge enabled={cap.serviceWorker} label="Service Worker" />
          <CapBadge enabled={cap.indexedDb} label="IndexedDB" />
          <CapBadge enabled={cap.webGpu} label="WebGPU" />
          <CapBadge enabled={cap.pdfViewer} label="PDF" />
          <CapBadge enabled={cap.touchSupport} label="Touch" />
          <CapBadge enabled={cap.cookiesEnabled} label="Cookies" />
          <CapBadge enabled={fingerprint.saveData} label="Data Saver" />
        </div>
      </div>
    </div>
  );
}
