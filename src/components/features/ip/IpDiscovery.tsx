'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Globe, MapPin, Zap, Search, Shield, RefreshCw,
  ChevronDown, ArrowRight, AlertTriangle, Info,
  Lock, Wifi, Server,
} from 'lucide-react';
import type { ConnectionRisk, IpData } from '../../../types/api';
import { CopyButton } from '../../ui/CopyButton';
import { Badge } from '../../ui/Badge';
import {
  formatCoords, formatLocation, countryFlag, continentName, fetchWithTimeout,
} from '../../../lib/utils';
import { isLikelyDatacenter, withTimezoneMismatch } from '../../../lib/ip';
import { collectBrowserFingerprint, type BrowserFingerprint } from '../../../lib/browser';
import { navigateToFeature } from '../../../lib/navigation';
import { ConnectionRiskBadge } from './ConnectionRiskBadge';
import { IpNeighbourhood } from './IpNeighbourhood';
import { RequestHeadersPanel } from './RequestHeadersPanel';
import { BrowserFingerprintPanel } from './BrowserFingerprintPanel';

function IpSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="ip-hero-glow rounded-2xl p-8">
        <div className="skeleton h-3 w-28 mb-4 rounded" />
        <div className="skeleton h-14 w-80 mb-4 rounded-xl" />
        <div className="flex gap-2 mb-6">
          <div className="skeleton h-6 w-20 rounded-full" />
          <div className="skeleton h-6 w-16 rounded-full" />
        </div>
        <div className="skeleton h-24 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function IpError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="size-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
        <AlertTriangle className="text-red-400" size={24} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-white/90 font-display font-semibold text-lg">Couldn&apos;t load your IP</p>
        <p className="font-mono text-[0.75rem] text-white/35 mt-1">{message}</p>
      </div>
      <button onClick={onRetry} className="cta-primary">Try again</button>
    </div>
  );
}

const TOOLS = [
  { id: 'geolocation_map', icon: MapPin, label: 'See on map', desc: 'Pin your approximate location', accent: 'from-violet-500/20 to-violet-500/5', iconColor: 'text-violet-400' },
  { id: 'speed_test', icon: Zap, label: 'Test speed', desc: 'Measure download & upload', accent: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-400' },
  { id: 'dns_resolver', icon: Search, label: 'Lookup DNS', desc: 'Query A, MX, TXT records', accent: 'from-sky-500/20 to-sky-500/5', iconColor: 'text-sky-400' },
  { id: 'webrtc_leak', icon: Shield, label: 'Check VPN leak', desc: 'Detect WebRTC IP exposure', accent: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-400' },
] as const;

function ToolCta({ tool }: { tool: typeof TOOLS[number] }) {
  const Icon = tool.icon;
  return (
    <button onClick={() => navigateToFeature(tool.id)} className={`cta-tool bg-gradient-to-br ${tool.accent} group`}>
      <div className={`size-9 rounded-xl bg-white/[0.06] flex items-center justify-center ${tool.iconColor}`}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[0.88rem] font-semibold text-white/90 group-hover:text-white transition-colors">{tool.label}</p>
        <p className="text-[0.72rem] text-white/35 truncate">{tool.desc}</p>
      </div>
      <ArrowRight size={15} className="text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat-pill">
      <span className="text-[0.65rem] uppercase tracking-wider text-white/30 font-medium">{label}</span>
      <span className="text-[0.82rem] text-white/85 font-medium">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-white/[0.04] last:border-0">
      <span className="text-[0.76rem] text-white/30 shrink-0">{label}</span>
      <span className="text-[0.78rem] font-mono text-white/75 text-right">{value ?? '—'}</span>
    </div>
  );
}

function protoBadgeVariant(proto: string | null) {
  if (!proto) return 'slate' as const;
  if (proto.includes('3')) return 'orange' as const;
  if (proto.includes('2')) return 'blue' as const;
  return 'slate' as const;
}

function connectionBadgeVariant(v: IpData['ipVersion']) {
  if (v === 'IPv6') return 'blue' as const;
  if (v === 'IPv4') return 'green' as const;
  return 'slate' as const;
}

function connectionLabel(v: IpData['ipVersion']) {
  if (v === 'IPv6') return 'IPv6 connection';
  if (v === 'IPv4') return 'IPv4 connection';
  return 'Unknown protocol';
}

export default function IpDiscovery() {
  const [data, setData] = useState<IpData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fingerprint, setFingerprint] = useState<BrowserFingerprint | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetchWithTimeout('/api/ip', {}, 10_000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: IpData = await res.json();
      setData(json);
      setFingerprint(await collectBrowserFingerprint());
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'AbortError'
        ? 'Request timed out — try again'
        : e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const connectionRisk: ConnectionRisk | null = useMemo(() => {
    if (!data) return null;
    if (!fingerprint) return data.connectionRisk;
    return withTimezoneMismatch(data.connectionRisk, data.timezone, fingerprint.timezone);
  }, [data, fingerprint]);

  if (loading) return <IpSkeleton />;
  if (error || !data) return <IpError message={error ?? 'No data'} onRetry={() => load()} />;

  const flag = countryFlag(data.country);
  const location = formatLocation(data.city, data.region, data.countryName ?? data.country);
  const showDatacenterHint = isLikelyDatacenter(data.asnOrg);
  const ispDisplay = data.asnOrg ?? 'Unknown ISP';
  const asnDisplay = data.asn != null ? `AS${data.asn}` : '—';
  const hasGeo = data.latitude != null && data.longitude != null;

  return (
    <div className="max-w-3xl mx-auto pb-8">

      {!data.edgeDataAvailable && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 animate-fade-up">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[0.78rem] text-amber-200/80 leading-relaxed">
            Edge data unavailable in local dev. Deploy to Cloudflare preview or production for real ASN &amp; geo data.
          </p>
        </div>
      )}

      {/* Hero */}
      <div className="ip-hero-glow rounded-2xl p-6 sm:p-8 mb-5 animate-fade-up">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Globe size={14} className="text-sky-400/70" />
            <p className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-white/35">Your public IP</p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            aria-label="Refresh IP data"
            className="flex items-center gap-1.5 text-[0.72rem] text-white/30 hover:text-white/70
                       transition-colors border-0 bg-transparent cursor-pointer disabled:opacity-40"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap mt-3">
          <span
            className="font-mono font-semibold text-white tracking-tight leading-none ip-glow-text"
            style={{ fontSize: 'clamp(1.8rem, 5vw, 2.75rem)' }}
          >
            {data.ip}
          </span>
          <CopyButton text={data.ip} />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Badge variant={connectionBadgeVariant(data.ipVersion)}>{connectionLabel(data.ipVersion)}</Badge>
          {flag && data.country && <Badge variant="slate">{flag} {data.countryName ?? data.country}</Badge>}
          {data.httpProtocol && <Badge variant={protoBadgeVariant(data.httpProtocol)}>{data.httpProtocol}</Badge>}
          {data.isEU && <Badge variant="slate">🇪🇺 EU</Badge>}
          {data.proxy.detected && <Badge variant="yellow">Proxy headers</Badge>}
        </div>

        <div className="isp-block rounded-xl p-4 sm:p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-white/25">Network identity</span>
            <CopyButton text={`${ispDisplay} · ${asnDisplay}`} className="size-[26px] !rounded-md" />
          </div>
          <div className="space-y-2.5 font-mono">
            <div>
              <span className="text-[0.65rem] uppercase tracking-wider text-sky-400/50 block mb-0.5">ISP</span>
              <span className="text-[0.92rem] text-white/90">{ispDisplay}</span>
            </div>
            <div className="h-px bg-white/[0.06]" />
            <div>
              <span className="text-[0.65rem] uppercase tracking-wider text-sky-400/50 block mb-0.5">ASN</span>
              <span className="text-[0.92rem] text-white/90">{asnDisplay}</span>
            </div>
          </div>
        </div>

        {connectionRisk && <ConnectionRiskBadge risk={connectionRisk} />}

        {showDatacenterHint && (
          <p className="mt-3 text-[0.72rem] text-white/30 leading-relaxed flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-0.5 text-white/25" />
            ISP name may reflect a VPN, proxy, or datacenter rather than your home provider.
          </p>
        )}
      </div>

      {/* Geo summary */}
      <div className="mb-5 animate-fade-up" style={{ '--delay': '0.04s' } as React.CSSProperties}>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-white/25 mb-2">
            Approximate location
          </p>
          <p className="text-[0.88rem] text-white/85 mb-1">
            {location !== 'Location unavailable' ? location : 'Location unavailable'}
            {data.postalCode ? ` · ${data.postalCode}` : ''}
          </p>
          <p className="text-[0.72rem] text-white/30">
            {hasGeo ? formatCoords(data.latitude, data.longitude) : 'Coordinates unavailable'}
            {data.timezone ? ` · ${data.timezone}` : ''}
          </p>
          <p className="text-[0.68rem] text-white/20 mt-2">
            City-level accuracy based on IP — may differ from your exact address.
          </p>
        </div>
      </div>

      <div className="mb-5 animate-fade-up" style={{ '--delay': '0.05s' } as React.CSSProperties}>
        <IpNeighbourhood ip={data.ip} />
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6 animate-fade-up" style={{ '--delay': '0.06s' } as React.CSSProperties}>
        <StatPill label="TLS" value={data.tlsVersion?.replace('TLSv', 'TLS ') ?? '—'} />
        <StatPill label="Edge PoP" value={data.colo ?? '—'} />
        <StatPill label="Latency" value={data.clientTcpRtt != null ? `${data.clientTcpRtt} ms` : '—'} />
        <StatPill label="Continent" value={continentName(data.continent) ?? '—'} />
      </div>

      {/* CTAs */}
      <div className="mb-6 animate-fade-up" style={{ '--delay': '0.12s' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-[0.95rem] text-white/80">Explore your connection</h2>
          <button
            onClick={() => navigateToFeature('service_status')}
            className="text-[0.72rem] text-sky-400/70 hover:text-sky-400 transition-colors border-0 bg-transparent cursor-pointer flex items-center gap-1"
          >
            Service status <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {TOOLS.map((tool) => <ToolCta key={tool.id} tool={tool} />)}
        </div>
      </div>

      {/* Advanced */}
      <div className="animate-fade-up" style={{ '--delay': '0.18s' } as React.CSSProperties}>
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl
                     border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]
                     transition-colors cursor-pointer"
        >
          <span className="text-[0.82rem] font-medium text-white/50 flex items-center gap-2">
            <Lock size={13} className="text-white/25" />
            Advanced details
          </span>
          <ChevronDown size={16} className={`text-white/30 transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        {advancedOpen && (
          <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#111318]/80 overflow-hidden animate-fade-up">
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-[0.68rem] uppercase tracking-wider text-white/25 font-semibold flex items-center gap-1.5">
                <Wifi size={12} /> Connection
              </p>
            </div>
            <div className="px-4 py-1">
              <DetailRow label="TLS cipher" value={data.tlsCipher} />
              <DetailRow label="HTTP priority" value={data.requestPriority} />
              <DetailRow label="Region code" value={data.regionCode} />
              <DetailRow label="Encodings" value={data.clientAcceptEncoding} />
              {data.proxy.chain.length > 0 && (
                <DetailRow label="IP chain" value={data.proxy.chain.join(' → ')} />
              )}
            </div>

            <div className="px-4 py-3 border-t border-b border-white/[0.05]">
              <p className="text-[0.68rem] uppercase tracking-wider text-white/25 font-semibold flex items-center gap-1.5">
                <Server size={12} /> Request headers
              </p>
            </div>
            <RequestHeadersPanel headers={data.headers} />

            {fingerprint && (
              <>
                <div className="px-4 py-3 border-t border-b border-white/[0.05]">
                  <p className="text-[0.68rem] uppercase tracking-wider text-white/25 font-semibold">
                    Browser fingerprint
                  </p>
                </div>
                <BrowserFingerprintPanel fingerprint={fingerprint} ipTimezone={data.timezone} />
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[0.65rem] font-mono text-white/15">
        Sourced from Cloudflare edge · {new Date(data.servedAt).toLocaleString()}
      </p>
    </div>
  );
}
