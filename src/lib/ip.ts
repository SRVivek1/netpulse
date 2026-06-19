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

  // Title-case ALL-CAPS org names: "GOOGLE LLC" → "Google Llc"
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
