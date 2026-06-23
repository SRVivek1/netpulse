'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, AlertTriangle, ShieldCheck, ShieldOff, RefreshCw } from 'lucide-react';
import type { DnsFullResult, DomainRegistration } from '../../../types/api';
import { fetchWithTimeout } from '../../../lib/utils';
import { Card, CardBody, CardHeader } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { DataRow } from '../../ui/DataRow';
import { CopyButton } from '../../ui/CopyButton';

const CACHE_TTL_MS = 60_000;
const CACHE_PREFIX = 'np-dns:full:';

interface CacheEntry {
  expiresAt: number;
  data: DnsFullResult;
}

function cacheKey(name: string): string {
  return `${CACHE_PREFIX}${name.trim().toLowerCase()}`;
}

function readCache(name: string): DnsFullResult | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(name));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(cacheKey(name));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(name: string, data: DnsFullResult): void {
  try {
    const entry: CacheEntry = { expiresAt: Date.now() + CACHE_TTL_MS, data };
    sessionStorage.setItem(cacheKey(name), JSON.stringify(entry));
  } catch {
    // sessionStorage full or unavailable
  }
}

function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function RegistrationCard({ registration }: { registration: DomainRegistration }) {
  if (!registration.found) {
    return (
      <Card>
        <CardHeader>Domain registration</CardHeader>
        <CardBody>
          <p className="px-4 py-5 text-[0.84rem] text-np-muted text-center">
            {registration.error ?? 'Registration data not available'}
          </p>
        </CardBody>
      </Card>
    );
  }

  const registered = formatDate(registration.registeredAt);
  const expires = formatDate(registration.expiresAt);
  const updated = formatDate(registration.updatedAt);

  return (
    <Card>
      <CardHeader>Domain registration</CardHeader>
      <CardBody>
        {registration.queriedDomain !== registration.domain && (
          <DataRow
            label="RDAP domain"
            mono
            value={registration.domain}
          />
        )}
        <DataRow
          label="Registrar"
          value={registration.registrar ?? '—'}
        />
        <DataRow
          label="Registrant"
          value={
            registration.registrant
              ? registration.registrant
              : registration.registrantRedacted
                ? 'Redacted for privacy'
                : '—'
          }
        />
        {registered && <DataRow label="Registered" value={registered} />}
        {expires && <DataRow label="Expires" value={expires} />}
        {updated && <DataRow label="Last changed" value={updated} />}
        {registration.status && registration.status.length > 0 && (
          <DataRow
            label="Status"
            value={
              <span className="flex flex-wrap gap-1 justify-end">
                {registration.status.map((s) => (
                  <Badge key={s} variant="slate">{s}</Badge>
                ))}
              </span>
            }
          />
        )}
        <p className="px-4 py-3 text-[0.72rem] text-np-faint border-t border-np">
          Sourced from public RDAP/WHOIS. Personal contact details are often withheld under privacy regulations.
        </p>
      </CardBody>
    </Card>
  );
}

function DnsSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-4 animate-fade-up">
      <div className="np-card p-5 space-y-4">
        <div className="skeleton h-10 w-full rounded-xl" />
        <div className="skeleton h-10 w-28 rounded-xl" />
      </div>
      {[...Array(3)].map((_, i) => (
        <div key={i} className="np-card overflow-hidden">
          <div className="skeleton h-10 w-full" />
          {[...Array(2)].map((_, j) => (
            <div key={j} className="px-4 py-3 border-b border-np last:border-0">
              <div className="skeleton h-4 w-48 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function DnsResolver() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<DnsFullResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runLookup = useCallback(async (name: string, skipCache = false) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a domain name or IP address');
      return;
    }

    setError(null);

    if (!skipCache) {
      const cached = readCache(trimmed);
      if (cached) {
        setResult(cached);
        return;
      }
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ name: trimmed });
      const response = await fetchWithTimeout(`/api/dns?${params}`);
      const body = await response.json() as DnsFullResult & { error?: string };

      if (!response.ok) {
        throw new Error(body.error ?? `Lookup failed (${response.status})`);
      }

      setResult(body);
      writeCache(trimmed, body);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runLookup(query, true);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const totalRecords = result?.sections.reduce((sum, s) => sum + s.records.length, 0) ?? 0;
  const hasDnssec = result?.sections.some((s) => s.dnssecAuthenticated) ?? false;

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display font-bold text-2xl text-np tracking-tight">DNS Lookup</h1>
        <p className="text-np-muted text-[0.88rem] mt-1">
          Look up DNS records and domain registration info — A, AAAA, MX, TXT, CNAME, NS, and SOA. IP addresses return reverse DNS (PTR).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="np-card p-5 space-y-4">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-np-faint pointer-events-none"
            size={16}
            strokeWidth={1.75}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="example.com"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-hover border border-np text-np font-mono text-[0.88rem] placeholder:text-np-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        <button type="submit" disabled={loading} className="cta-primary flex items-center gap-2">
          {loading ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Looking up…
            </>
          ) : (
            'Lookup'
          )}
        </button>
      </form>

      {loading && !result && <DnsSkeleton />}

      {error && (
        <div className="np-card p-4 flex items-start gap-3 border border-red-400/20 bg-red-400/5">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} strokeWidth={1.5} />
          <div>
            <p className="text-np font-medium text-[0.88rem]">Lookup failed</p>
            <p className="font-mono text-[0.75rem] text-np-muted mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-4 animate-fade-up">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="blue">{totalRecords} record{totalRecords === 1 ? '' : 's'}</Badge>
            {hasDnssec ? (
              <Badge variant="green">
                <ShieldCheck size={12} className="inline mr-1" />
                DNSSEC
              </Badge>
            ) : (
              <Badge variant="slate">
                <ShieldOff size={12} className="inline mr-1" />
                No DNSSEC AD
              </Badge>
            )}
            {result.resolver === 'fallback' && (
              <Badge variant="orange">Fallback resolver</Badge>
            )}
          </div>

          <Card>
            <CardHeader>Summary</CardHeader>
            <CardBody>
              <DataRow
                label="Name"
                mono
                value={
                  <span className="flex items-center gap-1.5">
                    {result.query}
                    <CopyButton text={result.query} />
                  </span>
                }
              />
              <DataRow
                label="Input"
                value={result.inputKind === 'ip' ? 'IP address (reverse DNS)' : 'Domain name'}
              />
              <DataRow
                label="Resolver"
                value={result.resolver === 'primary' ? 'Cloudflare DoH' : 'Google DoH (fallback)'}
              />
            </CardBody>
          </Card>

          {result.registration && (
            <RegistrationCard registration={result.registration} />
          )}

          {result.sections.map((section) => (
            <Card key={section.type}>
              <CardHeader className="justify-between">
                <span>{section.type}</span>
                <Badge variant={section.records.length > 0 ? 'green' : 'slate'}>
                  {section.records.length}
                </Badge>
              </CardHeader>
              <CardBody>
                {section.records.length === 0 ? (
                  <p className="px-4 py-5 text-[0.84rem] text-np-muted text-center">
                    No {section.type} records found
                  </p>
                ) : (
                  section.records.map((record, index) => (
                    <DataRow
                      key={`${record.name}-${record.type}-${index}`}
                      label={`${record.name} · TTL ${record.ttl}s`}
                      mono
                      value={
                        <span className="flex items-center gap-1.5 max-w-[70%] break-all">
                          {record.data}
                          <CopyButton text={record.data} />
                        </span>
                      }
                    />
                  ))
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
