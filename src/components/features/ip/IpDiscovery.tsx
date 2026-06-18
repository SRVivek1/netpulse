'use client';
import { useEffect, useState } from 'react';
import {
  Globe, GitBranch, MapPin, Zap,
  Wifi, AlertTriangle
} from 'lucide-react';
import type { IpData } from '../../../types/api';
import { Card, CardHeader, CardBody } from '../../ui/Card';
import { DataRow } from '../../ui/DataRow';
import { Badge } from '../../ui/Badge';
import { CopyButton } from '../../ui/CopyButton';
import { formatCoords, formatLocation } from '../../../lib/utils';

// ── Skeleton ──────────────────────────────────────────────────────────────
function IpSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <div className="skeleton h-3 w-24 mb-3 rounded" />
        <div className="skeleton h-12 w-72 mb-3 rounded-lg" style={{ maxWidth: '80%' }} />
        <div className="flex gap-2">
          <div className="skeleton h-5 w-16 rounded-full" />
          <div className="skeleton h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-44 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ── Error ─────────────────────────────────────────────────────────────────
function IpError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <AlertTriangle className="text-yellow-400/60" size={32} strokeWidth={1.5} />
      <p className="text-white/70 font-medium">Could not load IP data</p>
      <p className="font-mono text-[0.75rem] text-white/30">{message}</p>
      <button
        onClick={onRetry}
        className="mt-2 px-4 py-2 rounded-lg bg-sky-400 text-black text-sm font-semibold
                   hover:bg-sky-300 transition-colors cursor-pointer border-0"
      >
        Retry
      </button>
    </div>
  );
}

// ── Protocol badge variant ────────────────────────────────────────────────
function protoBadgeVariant(proto: string | null) {
  if (!proto) return 'slate' as const;
  if (proto.includes('3')) return 'orange' as const;
  if (proto.includes('2')) return 'blue' as const;
  return 'slate' as const;
}

// ── Main component ────────────────────────────────────────────────────────
export default function IpDiscovery() {
  const [data, setData] = useState<IpData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ip');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <IpSkeleton />;
  if (error || !data) return <IpError message={error ?? 'No data'} onRetry={load} />;

  const isIPv6 = data.ipVersion === 'IPv6';

  return (
    <div>
      {/* ── Hero ── */}
      <div className="mb-7 animate-fade-up" style={{ '--delay': '0s' } as React.CSSProperties}>
        <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-white/25 mb-2">
          Your IP Address
        </p>

        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="font-display font-bold text-white/95 tracking-tight leading-none"
                style={{ fontSize: 'clamp(1.7rem, 4vw, 2.6rem)' }}>
            {data.ip}
          </span>
          <CopyButton text={data.ip} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={isIPv6 ? 'blue' : 'green'}>
            {data.ipVersion}
          </Badge>
          {isIPv6 && <Badge variant="slate">Dual-Stack Capable</Badge>}
          {data.isEU && <Badge variant="slate">🇪🇺 EU</Badge>}
        </div>
      </div>

      {/* ── Cards grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">

        {/* Network / ASN */}
        <Card className="animate-fade-up" style={{ '--delay': '0.06s' } as React.CSSProperties}>
          <CardHeader>
            <GitBranch size={13} strokeWidth={1.75} />
            Network / ASN
          </CardHeader>
          <CardBody>
            <DataRow label="ASN" value={data.asn != null ? `AS${data.asn}` : null} mono />
            <DataRow label="Organization" value={data.asnOrg} />
            <DataRow label="Edge PoP" value={data.colo} mono />
          </CardBody>
        </Card>

        {/* Location */}
        <Card className="animate-fade-up" style={{ '--delay': '0.12s' } as React.CSSProperties}>
          <CardHeader>
            <MapPin size={13} strokeWidth={1.75} />
            Location
          </CardHeader>
          <CardBody>
            <DataRow label="City / Region"
              value={formatLocation(data.city, data.region) || null} />
            <DataRow label="Country" value={data.country} mono />
            <DataRow label="Postal Code" value={data.postalCode} mono />
            <DataRow label="Timezone" value={data.timezone} mono />
            <DataRow label="Coordinates"
              value={formatCoords(data.latitude, data.longitude)} mono />
          </CardBody>
        </Card>

        {/* Connection */}
        <Card className="animate-fade-up" style={{ '--delay': '0.18s' } as React.CSSProperties}>
          <CardHeader>
            <Zap size={13} strokeWidth={1.75} />
            Connection
          </CardHeader>
          <CardBody>
            <DataRow label="Protocol"
              value={data.httpProtocol
                ? <Badge variant={protoBadgeVariant(data.httpProtocol)}>{data.httpProtocol}</Badge>
                : null}
            />
            <DataRow label="TLS Version"
              value={data.tlsVersion
                ? <Badge variant={data.tlsVersion.includes('1.3') ? 'green' : 'yellow'}>{data.tlsVersion}</Badge>
                : null}
            />
            <DataRow label="TLS Cipher"
              value={<span className="text-[0.72rem]">{data.tlsCipher ?? '—'}</span>}
              mono
            />
            <DataRow label="TCP RTT (CF↔client)"
              value={data.clientTcpRtt != null ? `${data.clientTcpRtt} ms` : null}
              mono
            />
          </CardBody>
        </Card>

      </div>

      {/* Timestamp */}
      <p className="mt-5 text-[0.68rem] font-mono text-white/18">
        Data sourced from Cloudflare edge · {new Date(data.servedAt).toLocaleString()}
      </p>
    </div>
  );
}
