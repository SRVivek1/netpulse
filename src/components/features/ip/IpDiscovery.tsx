'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Globe, Zap, Search, Shield, RefreshCw,
  ChevronDown, ArrowRight, AlertTriangle, Info,
  Lock, Wifi, Server,
} from 'lucide-react';
import type { ConnectionRisk, IpData } from '../../../types/api';
import type { AppConfig } from '../../../types/config';
import { CopyButton } from '../../ui/CopyButton';
import { Badge } from '../../ui/Badge';
import { BentoGrid } from '../../ui/BentoGrid';
import { BentoTile } from '../../ui/BentoTile';
import { DataField } from '../../ui/DataField';
import { countryFlag, continentName, fetchWithTimeout, formatCoords, formatLocation } from '../../../lib/utils';
import { isLikelyDatacenter, withTimezoneMismatch } from '../../../lib/ip';
import { collectBrowserFingerprint, type BrowserFingerprint } from '../../../lib/browser';
import { navigateToFeature } from '../../../lib/navigation';
import { GeoMapPanel } from '../geolocation/GeoMapPanel';
import { ConnectionRiskBadge } from './ConnectionRiskBadge';
import { IpNeighbourhood } from './IpNeighbourhood';
import { RequestHeadersPanel } from './RequestHeadersPanel';
import { BrowserFingerprintPanel } from './BrowserFingerprintPanel';
import { LatencyTile } from './LatencyTile';
import { ThreatIntelPlaceholder } from './ThreatIntelPlaceholder';

function IpSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <BentoGrid>
        <div className="bento-tile np-card np-card-glass p-5 lg:col-span-7 md:col-span-6">
          <div className="skeleton h-3 w-28 mb-4 rounded" />
          <div className="skeleton h-12 w-72 mb-4 rounded-xl" />
          <div className="flex gap-2">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        </div>
        <div className="bento-tile np-card p-5 lg:col-span-5 md:col-span-3">
          <div className="skeleton h-3 w-24 mb-4 rounded" />
          <div className="skeleton h-20 w-full rounded-xl" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bento-tile np-card p-5 lg:col-span-4 md:col-span-2">
            <div className="skeleton h-3 w-20 mb-4 rounded" />
            <div className="skeleton h-4 w-32 mb-2 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
          </div>
        ))}
        <div className="bento-tile np-card p-5 lg:col-span-8 md:col-span-6">
          <div className="skeleton h-[280px] w-full rounded-xl" />
        </div>
        <div className="bento-tile np-card p-5 lg:col-span-4 md:col-span-3">
          <div className="skeleton h-24 w-full rounded" />
        </div>
        <div className="bento-tile np-card p-5 lg:col-span-8 md:col-span-6">
          <div className="skeleton h-32 w-full rounded-xl" />
        </div>
        <div className="bento-tile np-card p-5 lg:col-span-4 md:col-span-3">
          <div className="grid grid-cols-2 gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" />
            ))}
          </div>
        </div>
      </BentoGrid>
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
        <p className="text-np font-display font-semibold text-lg">Couldn&apos;t load your IP</p>
        <p className="font-mono text-[0.75rem] text-np-muted mt-1">{message}</p>
      </div>
      <button onClick={onRetry} className="cta-primary">Try again</button>
    </div>
  );
}

const TOOLS = [
  { id: 'speed_test', icon: Zap, label: 'Test speed', desc: 'Measure download & upload', accent: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-400' },
  { id: 'dns_resolver', icon: Search, label: 'Lookup DNS', desc: 'Query A, MX, TXT records', accent: 'from-accent/20 to-accent/5', iconColor: 'text-accent' },
  { id: 'webrtc_leak', icon: Shield, label: 'Check VPN leak', desc: 'Detect WebRTC IP exposure', accent: 'from-emerald-500/20 to-emerald-500/5', iconColor: 'text-emerald-400' },
] as const;

function ToolCta({ tool }: { tool: typeof TOOLS[number] }) {
  const Icon = tool.icon;
  return (
    <button onClick={() => navigateToFeature(tool.id)} className={`cta-tool np-card bg-gradient-to-br ${tool.accent} group`}>
      <div className={`size-9 rounded-xl bg-hover flex items-center justify-center ${tool.iconColor}`}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-[0.88rem] font-semibold text-np group-hover:text-np transition-colors">{tool.label}</p>
        <p className="text-[0.72rem] text-np-muted truncate">{tool.desc}</p>
      </div>
      <ArrowRight size={15} className="text-np-faint group-hover:text-np/60 group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-np last:border-0">
      <span className="text-[0.76rem] text-np-faint shrink-0">{label}</span>
      <span className="text-[0.78rem] font-mono text-np text-right">{value ?? '—'}</span>
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
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
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
      const [ipRes, cfgRes] = await Promise.all([
        fetchWithTimeout('/api/ip', {}, 10_000),
        fetchWithTimeout('/api/config', {}, 10_000),
      ]);
      if (!ipRes.ok) throw new Error(`IP API HTTP ${ipRes.status}`);
      if (!cfgRes.ok) throw new Error(`Config API HTTP ${cfgRes.status}`);
      setData(await ipRes.json());
      setAppConfig(await cfgRes.json());
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
  if (error || !data || !appConfig) return <IpError message={error ?? 'No data'} onRetry={() => load()} />;

  const flag = countryFlag(data.country);
  const showDatacenterHint = isLikelyDatacenter(data.asnOrg);
  const ispDisplay = data.asnOrg ?? 'Unknown ISP';
  const asnDisplay = data.asn != null ? `AS${data.asn}` : '—';
  const location = formatLocation(data.city, data.region, data.countryName ?? data.country);
  const coordText = formatCoords(data.latitude, data.longitude);
  const browserTimezone = fingerprint?.timezone ?? null;
  const timezoneMismatch = Boolean(
    data.timezone && browserTimezone && data.timezone !== browserTimezone,
  );

  return (
    <div className="max-w-7xl mx-auto pb-8">

      {!data.edgeDataAvailable && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 animate-fade-up">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[0.78rem] text-amber-200/80 leading-relaxed">
            Edge data unavailable in local dev. Deploy to Cloudflare preview or production for real ASN &amp; geo data.
          </p>
        </div>
      )}

      <BentoGrid className="mb-5">
        {/* Row 1: IP + Latency */}
        <BentoTile
          title="Target vector host"
          colSpan={7}
          mdColSpan={6}
          glass
          footer="Status: routing verified via Cloudflare edge"
          className="animate-fade-up"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-accent/70" />
            </div>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh IP data"
              className="flex items-center gap-1.5 text-[0.72rem] text-np-faint hover:text-np
                         transition-colors border-0 bg-transparent cursor-pointer disabled:opacity-40"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span
              className="font-mono font-semibold text-np tracking-tight leading-none ip-glow-text cursor-pointer select-all"
              style={{ fontSize: 'clamp(1.6rem, 4vw, 2.5rem)' }}
            >
              {data.ip}
            </span>
            <CopyButton text={data.ip} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={connectionBadgeVariant(data.ipVersion)}>{connectionLabel(data.ipVersion)}</Badge>
            {flag && data.country && <Badge variant="slate">{flag} {data.countryName ?? data.country}</Badge>}
            {data.httpProtocol && <Badge variant={protoBadgeVariant(data.httpProtocol)}>{data.httpProtocol}</Badge>}
            {data.isEU && <Badge variant="slate">🇪🇺 EU</Badge>}
            {data.proxy.detected && <Badge variant="yellow">Proxy headers</Badge>}
          </div>
        </BentoTile>

        <LatencyTile
          rttMs={data.clientTcpRtt}
          className="animate-fade-up"
          style={{ '--delay': '0.03s' } as React.CSSProperties}
        />

        {/* Row 2: GEO / BGP / STACK */}
        <BentoTile
          title="Geo target location"
          badge="GEO"
          numbered="01 /"
          colSpan={4}
          mdColSpan={2}
          footer="Accuracy: city-level (~50–200 km)"
          className="animate-fade-up"
          style={{ '--delay': '0.05s' } as React.CSSProperties}
        >
          <DataField
            label="Location"
            value={
              <>
                {flag && <span className="mr-1">{flag}</span>}
                {location}
              </>
            }
          />
          <DataField label="Coordinates" value={coordText} mono />
          <DataField label="Timezone" value={data.timezone} mono />
        </BentoTile>

        <BentoTile
          title="BGP transit autonomous"
          badge="BGP"
          numbered="02 /"
          colSpan={4}
          mdColSpan={2}
          footer={`Peering layer: ${data.colo ?? 'edge'}`}
          className="animate-fade-up"
          style={{ '--delay': '0.06s' } as React.CSSProperties}
        >
          <DataField label="Organization / ISP" value={ispDisplay} />
          <DataField label="ASN" value={asnDisplay} mono />
          <DataField label="Edge PoP" value={data.colo} mono />
          <DataField label="Continent" value={continentName(data.continent) ?? '—'} />
        </BentoTile>

        <BentoTile
          title="Dual-stack interface"
          badge="STACK"
          numbered="03 /"
          colSpan={4}
          mdColSpan={2}
          footer="MTU interface: 1500 bytes"
          className="animate-fade-up"
          style={{ '--delay': '0.07s' } as React.CSSProperties}
        >
          <DataField
            label="IPv4 status"
            value={data.ipVersion === 'IPv4' ? 'Active' : data.ipVersion === 'IPv6' ? 'Dual-stack' : '—'}
            mono
          />
          <DataField
            label="IPv6 / address"
            value={data.ipVersion === 'IPv6' ? data.ip : 'Not detected'}
            mono
          />
          <DataField label="TLS" value={data.tlsVersion?.replace('TLSv', 'TLS ') ?? '—'} mono />
          <DataField label="HTTP protocol" value={data.httpProtocol} mono />
        </BentoTile>

        {/* Row 3: Map + Security */}
        <BentoTile
          title="Geolocation map"
          badge="MAP"
          colSpan={8}
          mdColSpan={6}
          className="animate-fade-up !p-4"
          style={{ '--delay': '0.09s' } as React.CSSProperties}
        >
          <GeoMapPanel ipData={data} appConfig={appConfig} compact />
        </BentoTile>

        <BentoTile
          title="Privacy gateway seal"
          badge="WALL"
          numbered="04 /"
          colSpan={4}
          mdColSpan={3}
          footer="Header inspection verified"
          className="animate-fade-up"
          style={{ '--delay': '0.1s' } as React.CSSProperties}
        >
          {connectionRisk && (
            <div className="mb-3">
              <ConnectionRiskBadge risk={connectionRisk} embedded />
            </div>
          )}
          {showDatacenterHint && (
            <p className="text-[0.7rem] text-np-faint leading-relaxed flex items-start gap-1.5 mb-3">
              <Info size={11} className="shrink-0 mt-0.5" />
              ISP may reflect VPN, proxy, or datacenter routing.
            </p>
          )}
          <DataField
            label="Proxy headers"
            value={data.proxy.detected ? 'Detected' : 'None'}
            mono
          />
          {data.proxy.chain.length > 0 && (
            <DataField label="IP chain" value={data.proxy.chain.join(' → ')} mono />
          )}
          {timezoneMismatch && (
            <p className="text-[0.7rem] text-orange-300/70 mt-2 flex items-start gap-1.5">
              <Info size={11} className="shrink-0 mt-0.5" />
              Timezone mismatch: browser ({browserTimezone}) vs IP ({data.timezone}).
            </p>
          )}
        </BentoTile>

        {/* Row 4: Neighbourhood + Threat intel */}
        <div
          className="lg:col-span-8 md:col-span-6 animate-fade-up"
          style={{ '--delay': '0.12s' } as React.CSSProperties}
        >
          <IpNeighbourhood ip={data.ip} />
        </div>

        <div
          className="lg:col-span-4 md:col-span-3 animate-fade-up"
          style={{ '--delay': '0.13s' } as React.CSSProperties}
        >
          <ThreatIntelPlaceholder />
        </div>
      </BentoGrid>

      {/* Tool CTAs */}
      <div className="mb-6 animate-fade-up" style={{ '--delay': '0.14s' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-[0.95rem] text-np">Explore your connection</h2>
          <button
            onClick={() => navigateToFeature('service_status')}
            className="text-[0.72rem] text-accent/70 hover:text-accent transition-colors border-0 bg-transparent cursor-pointer flex items-center gap-1"
          >
            Service status <ArrowRight size={12} />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {TOOLS.map((tool) => <ToolCta key={tool.id} tool={tool} />)}
        </div>
      </div>

      {/* Advanced */}
      <div className="animate-fade-up" style={{ '--delay': '0.18s' } as React.CSSProperties}>
        <button
          onClick={() => setAdvancedOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 np-card hover:bg-hover transition-colors cursor-pointer"
        >
          <span className="text-[0.82rem] font-medium text-np-muted flex items-center gap-2">
            <Lock size={13} className="text-np-faint" />
            Advanced details
          </span>
          <ChevronDown size={16} className={`text-np-faint transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`} />
        </button>

        {advancedOpen && (
          <div className="mt-2 np-card overflow-hidden animate-fade-up">
            <div className="px-4 py-3 border-b border-np">
              <p className="text-[0.68rem] uppercase tracking-wider text-np-faint font-semibold flex items-center gap-1.5">
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

            <div className="px-4 py-3 border-t border-b border-np">
              <p className="text-[0.68rem] uppercase tracking-wider text-np-faint font-semibold flex items-center gap-1.5">
                <Server size={12} /> Request headers
              </p>
            </div>
            <RequestHeadersPanel headers={data.headers} />

            {fingerprint && (
              <>
                <div className="px-4 py-3 border-t border-b border-np">
                  <p className="text-[0.68rem] uppercase tracking-wider text-np-faint font-semibold">
                    Browser fingerprint
                  </p>
                </div>
                <BrowserFingerprintPanel fingerprint={fingerprint} ipTimezone={data.timezone} />
              </>
            )}
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-[0.65rem] font-mono text-np-faint">
        Sourced from Cloudflare edge · {new Date(data.servedAt).toLocaleString()}
      </p>
    </div>
  );
}
