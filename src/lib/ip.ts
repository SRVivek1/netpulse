import type { ProxyDetection } from '../types/api';

/** Detect connection IP version, handling IPv4-mapped IPv6 addresses. */
export function detectIpVersion(ip: string): 'IPv4' | 'IPv6' | 'unknown' {
  if (!ip || ip === 'unknown') return 'unknown';

  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return 'IPv4';

  if (ip.includes(':')) return 'IPv6';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return 'IPv4';

  return 'unknown';
}

/** Parse a Cloudflare geo coordinate string safely. */
export function parseCoord(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/** Normalize raw RIR organization strings for display. */
export function normalizeAsOrg(org: string | null | undefined): string | null {
  if (org == null) return null;
  const trimmed = org.trim();
  if (!trimmed) return null;

  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((word) => {
        const upper = ['llc', 'inc', 'ltd', 'plc', 'gmbh', 'ag', 'sa', 'bv', 'lp'];
        if (upper.includes(word)) return word.toUpperCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }

  return trimmed;
}

const DATACENTER_KEYWORDS = [
  'amazon', 'aws', 'google', 'gcp', 'microsoft', 'azure',
  'digitalocean', 'vultr', 'linode', 'akamai', 'cloudflare',
  'ovh', 'hetzner', 'choopa', 'm247', 'nordvpn', 'expressvpn',
  'datacenter', 'hosting', 'server', 'cloud', 'vpn', 'proxy',
  'tor', 'colocation',
];

/** Heuristic: org name suggests VPN, proxy, or datacenter rather than residential ISP. */
export function isLikelyDatacenter(org: string | null): boolean {
  if (!org) return false;
  const lower = org.toLowerCase();
  return DATACENTER_KEYWORDS.some((kw) => lower.includes(kw));
}

/** True when Cloudflare edge metadata is unavailable (typical in local dev). */
export function isEdgeDataUnavailable(
  ip: string,
  asn: unknown,
  colo: unknown,
): boolean {
  return ip === 'unknown' || (asn == null && colo == null);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function intToIpv4(n: number): string {
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.');
}

/** Adjacent IPs in the same /24 neighbourhood (IPv4 only). */
export function getIpNeighbourhood(
  ip: string,
  radius = 10,
): { ips: string[]; currentIndex: number } | null {
  if (detectIpVersion(ip) !== 'IPv4') return null;
  const base = ipv4ToInt(ip);
  if (base == null) return null;

  const ips: string[] = [];
  for (let offset = -radius; offset <= radius; offset++) {
    const next = (base + offset) >>> 0;
    ips.push(intToIpv4(next));
  }

  return { ips, currentIndex: radius };
}

const REDACTED_HEADERS = new Set([
  'cookie',
  'authorization',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'cf-access-jwt-assertion',
]);

/** Collect incoming request headers safe to echo to the client. */
export function collectSafeHeaders(request: Request): Record<string, string> {
  const out: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (REDACTED_HEADERS.has(lower)) return;
    out[lower] = value;
  });
  return Object.fromEntries(
    Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
  );
}

const PROXY_HEADER_NAMES = [
  'via',
  'x-forwarded-for',
  'forwarded',
  'x-real-ip',
  'x-forwarded-proto',
  'x-forwarded-host',
  'cf-connecting-ip',
];

function parseForwardedChain(forwarded: string): string[] {
  return forwarded
    .split(',')
    .flatMap((part) => {
      const match = part.match(/for="?\[?([^;\],"\s]+)/i);
      return match?.[1] ? [match[1]] : [];
    });
}

/** Detect proxy-related signals from incoming headers. */
export function detectProxyFromHeaders(
  request: Request,
  clientIp: string,
): ProxyDetection {
  const signals: string[] = [];
  const chain: string[] = [];
  const headers: Record<string, string> = {};

  for (const name of PROXY_HEADER_NAMES) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  if (headers.via) {
    signals.push('Via header present');
  }

  const xff = headers['x-forwarded-for'];
  if (xff) {
    const hops = xff.split(',').map((s) => s.trim()).filter(Boolean);
    chain.push(...hops);
    if (hops.length > 1) signals.push(`${hops.length} X-Forwarded-For hops`);
    if (hops[0] && hops[0] !== clientIp) {
      signals.push('X-Forwarded-For differs from client IP');
    }
  }

  if (headers.forwarded) {
    const fwd = parseForwardedChain(headers.forwarded);
    if (fwd.length) chain.push(...fwd);
    signals.push('Forwarded header present');
  }

  const uniqueChain = [...new Set(chain.filter(Boolean))];

  return {
    detected: signals.length > 0,
    signals,
    chain: uniqueChain,
    headers,
  };
}

export type ConnectionRiskLevel = 'low' | 'medium' | 'high';

export interface ConnectionRiskAssessment {
  level: ConnectionRiskLevel;
  label: string;
  reasons: string[];
}

/** Score connection type from server-side signals (ASN + proxy headers). */
export function assessConnectionRisk(
  proxy: ProxyDetection,
  asnOrg: string | null,
): ConnectionRiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  if (proxy.detected) {
    score += 2;
    reasons.push(...proxy.signals);
  }
  if (isLikelyDatacenter(asnOrg)) {
    score += 2;
    reasons.push('ISP appears to be a datacenter, hosting, or VPN provider');
  }

  if (score >= 3) {
    return { level: 'high', label: 'Likely VPN or proxy', reasons };
  }
  if (score >= 1) {
    return { level: 'medium', label: 'Possible proxy or datacenter', reasons };
  }
  return {
    level: 'low',
    label: 'Typical residential ISP',
    reasons: ['No proxy headers or datacenter ISP detected'],
  };
}

/** Bump risk when browser timezone differs from IP geo timezone. */
export function withTimezoneMismatch(
  risk: ConnectionRiskAssessment,
  ipTimezone: string | null,
  browserTimezone: string | null,
): ConnectionRiskAssessment {
  if (!ipTimezone || !browserTimezone || ipTimezone === browserTimezone) return risk;

  const reasons = [...risk.reasons, `Timezone mismatch: browser ${browserTimezone} vs IP ${ipTimezone}`];
  const level: ConnectionRiskLevel =
    risk.level === 'low' ? 'medium' : 'high';

  return {
    level,
    label: level === 'high' ? 'Likely VPN or proxy' : 'Possible proxy or datacenter',
    reasons,
  };
}
