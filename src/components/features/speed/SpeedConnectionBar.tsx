'use client';
import { cn } from '../../../lib/utils';

export interface SpeedConnectionInfo {
  ip: string | null;
  asn: number | null;
  asnOrg: string | null;
  edgeColo: string | null;
}

interface SpeedConnectionBarProps {
  connection: SpeedConnectionInfo;
  className?: string;
}

export function SpeedConnectionBar({ connection, className }: SpeedConnectionBarProps) {
  const { ip, asn, asnOrg, edgeColo } = connection;

  const ispLabel = asnOrg ?? 'Unknown ISP';
  const asnSuffix = asn != null ? ` (AS${asn})` : '';

  return (
    <div
      className={cn(
        'w-full mt-8 speed-glass-panel rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-np-muted',
        className,
      )}
    >
      <div className="flex items-center space-x-3">
        <div className="text-np-muted bg-[var(--np-bg-elevated)] border border-np px-2.5 py-1 rounded-md">
          ISP
        </div>
        <div>
          {ispLabel}
          {asnSuffix && (
            <span className="text-[10px] text-np-faint">{asnSuffix}</span>
          )}
        </div>
      </div>

      {edgeColo && (
        <div className="text-[11px] text-np-muted">
          Edge: <span className="text-np">{edgeColo}</span>
        </div>
      )}

      <div className="text-[11px] text-np-muted">
        IP: <span className="text-np">{ip ?? '—'}</span>
      </div>
    </div>
  );
}
