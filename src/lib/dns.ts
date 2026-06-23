/** Supported DNS record types for lookup. */
export const DNS_RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'PTR'] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

export interface DnsRecordTypeInfo {
  label: string;
  description: string;
}

/** Plain-language names and usage notes for each record type. */
export const DNS_RECORD_TYPE_INFO: Record<DnsRecordType, DnsRecordTypeInfo> = {
  A: {
    label: 'IPv4 address',
    description: 'Maps your domain to the server that hosts your website or app using an IPv4 address (for example, 192.0.2.1).',
  },
  AAAA: {
    label: 'IPv6 address',
    description: 'Same role as an A record, but points to an IPv6 address — the newer, longer address format used on modern networks.',
  },
  MX: {
    label: 'Mail server',
    description: 'Tells email systems which servers should receive mail sent to addresses at your domain.',
  },
  TXT: {
    label: 'Text record',
    description: 'Stores short text values used for email security (SPF, DKIM, DMARC), domain ownership verification, and other service settings.',
  },
  CNAME: {
    label: 'Alias',
    description: 'Points one hostname to another so you can reuse an existing destination — for example, sending www to your main site host.',
  },
  NS: {
    label: 'Name server',
    description: 'Lists the DNS servers that are authoritative for your domain and answer lookups on its behalf.',
  },
  SOA: {
    label: 'Zone authority',
    description: 'Holds administrative details about your DNS zone, such as the primary name server and how often secondary servers should refresh.',
  },
  PTR: {
    label: 'Reverse DNS',
    description: 'Maps an IP address back to a hostname. Often used for reverse lookups, logging, and email deliverability checks.',
  },
};

export function getDnsRecordTypeInfo(type: string): DnsRecordTypeInfo {
  if (isDnsRecordType(type)) return DNS_RECORD_TYPE_INFO[type];
  return {
    label: type,
    description: 'DNS record associated with this domain or IP address.',
  };
}

export interface DnsGlossaryEntry {
  term: string;
  label: string;
  description: string;
}

const DNS_LOOKUP_GLOSSARY_ORDER = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA', 'PTR'] as const satisfies readonly DnsRecordType[];

const DNS_METHOD_GLOSSARY: DnsGlossaryEntry[] = [
  {
    term: 'DoH',
    label: 'DNS-over-HTTPS resolver',
    description: 'DNS queries are sent over encrypted HTTPS to Cloudflare\'s public resolver (1.1.1.1), with Google DoH as a fallback when needed.',
  },
  {
    term: 'RDAP',
    label: 'Registration lookup',
    description: 'Registration Data Access Protocol — the modern successor to WHOIS. Returns registrar, registration dates, status codes, and other public ownership data.',
  },
];

/** Glossary for the DNS lookup intro — record types plus resolver and registration methods. */
export const DNS_LOOKUP_GLOSSARY: DnsGlossaryEntry[] = [
  ...DNS_LOOKUP_GLOSSARY_ORDER.map((type) => ({
    term: type,
    label: DNS_RECORD_TYPE_INFO[type].label,
    description: DNS_RECORD_TYPE_INFO[type].description,
  })),
  ...DNS_METHOD_GLOSSARY,
];

/** Record types queried for a full domain lookup. */
export const DOMAIN_RECORD_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'] as const satisfies readonly DnsRecordType[];

export type DnsInputKind = 'domain' | 'ip';

const DNS_TYPE_CODES: Record<DnsRecordType, number> = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
  SOA: 6,
  PTR: 12,
};

/** RFC 1123 hostname (labels 1–63 chars, total ≤253). */
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPV6_RE = /^[0-9a-f:.]+$/i;

export function dnsTypeCode(type: DnsRecordType): number {
  return DNS_TYPE_CODES[type];
}

export function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

/** Expand IPv6 to 32 nibbles for PTR construction. */
function expandIpv6(ip: string): string | null {
  const lower = ip.toLowerCase();
  if (!IPV6_RE.test(lower) || lower.includes('.')) return null;

  const [head, tail] = lower.split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missing = 8 - headParts.length - tailParts.length;
  if (missing < 0) return null;

  const groups = [
    ...headParts,
    ...Array.from({ length: missing }, () => '0'),
    ...tailParts,
  ];
  if (groups.length !== 8) return null;

  try {
    return groups
      .map((group) => group.padStart(4, '0'))
      .join('');
  } catch {
    return null;
  }
}

/** Convert IPv4 or IPv6 address to PTR query name. */
export function ipToPtrName(ip: string): string | null {
  const trimmed = ip.trim();
  if (isValidIpv4(trimmed)) {
    return `${trimmed.split('.').reverse().join('.')}.in-addr.arpa`;
  }

  const expanded = expandIpv6(trimmed);
  if (!expanded) return null;
  return `${expanded.split('').reverse().join('.')}.ip6.arpa`;
}

/**
 * Normalize and validate a DNS query name.
 * For PTR, accepts IPv4/IPv6 and converts to in-addr.arpa / ip6.arpa.
 */
export function normalizeQueryName(input: string, type: DnsRecordType): string | null {
  const trimmed = input.trim().replace(/\.$/, '');
  if (!trimmed) return null;

  if (type === 'PTR') {
    if (trimmed.endsWith('.in-addr.arpa') || trimmed.endsWith('.ip6.arpa')) {
      return /^[a-z0-9.-]+$/i.test(trimmed) ? trimmed : null;
    }
    if (isValidIpv4(trimmed) || IPV6_RE.test(trimmed)) {
      return ipToPtrName(trimmed);
    }
  }

  if (!HOSTNAME_RE.test(trimmed)) return null;
  return trimmed;
}

export function isDnsRecordType(value: string): value is DnsRecordType {
  return (DNS_RECORD_TYPES as readonly string[]).includes(value);
}

/** Validate and normalize a domain hostname. */
export function normalizeDomainName(input: string): string | null {
  const trimmed = input.trim().replace(/\.$/, '');
  if (!trimmed || !HOSTNAME_RE.test(trimmed)) return null;
  return trimmed;
}

function isValidIpv6(ip: string): boolean {
  return expandIpv6(ip) !== null;
}

/** Detect whether input is an IP address or a domain name. */
export function detectInputKind(input: string): DnsInputKind | null {
  const trimmed = input.trim().replace(/\.$/, '');
  if (!trimmed) return null;
  if (isValidIpv4(trimmed) || isValidIpv6(trimmed)) return 'ip';
  if (HOSTNAME_RE.test(trimmed)) return 'domain';
  return null;
}

/** Normalize input for a full lookup (domain as-is, IP converted to PTR name). */
export function normalizeFullLookupName(input: string): { kind: DnsInputKind; query: string } | null {
  const trimmed = input.trim().replace(/\.$/, '');
  if (!trimmed) return null;

  if (trimmed.endsWith('.in-addr.arpa') || trimmed.endsWith('.ip6.arpa')) {
    return /^[a-z0-9.-]+$/i.test(trimmed) ? { kind: 'ip', query: trimmed } : null;
  }

  if (isValidIpv4(trimmed) || isValidIpv6(trimmed)) {
    const ptr = ipToPtrName(trimmed);
    return ptr ? { kind: 'ip', query: ptr } : null;
  }

  const domain = normalizeDomainName(trimmed);
  return domain ? { kind: 'domain', query: domain } : null;
}

/** Record types to query for a given input kind. */
export function recordTypesForInputKind(kind: DnsInputKind): DnsRecordType[] {
  return kind === 'ip' ? ['PTR'] : [...DOMAIN_RECORD_TYPES];
}
