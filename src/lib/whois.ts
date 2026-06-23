import { normalizeDomainName } from './dns';
import type { DomainRegistration } from '../types/api';

const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const RDAP_ORG_BASE = 'https://rdap.org/domain';
const RDAP_HEADERS = {
  Accept: 'application/rdap+json, application/json',
  'User-Agent': 'NetPulse/1.0 (RDAP lookup; +https://netpulse.app)',
};
const REDACTED_PATTERN = /redact|data protected|not disclosed|privacy|withheld/i;

interface RdapBootstrap {
  services: Array<[string[], string[]]>;
}

let bootstrapCache: RdapBootstrap | null = null;

type VcardProp = [string, Record<string, string>, string, string];
type VcardArray = ['vcard', VcardProp[]];

interface RdapEntity {
  roles?: string[];
  vcardArray?: VcardArray;
  entities?: RdapEntity[];
}

interface RdapResponse {
  ldhName?: string;
  status?: string[];
  events?: Array<{ eventAction: string; eventDate: string }>;
  entities?: RdapEntity[];
  errorCode?: number;
}

function vcardField(vcard: VcardArray | undefined, field: string): string | null {
  if (!vcard || vcard[0] !== 'vcard' || !Array.isArray(vcard[1])) return null;
  for (const prop of vcard[1]) {
    if (prop[0] === field) {
      const val = String(prop[3] ?? '').trim();
      if (!val) return null;
      if (REDACTED_PATTERN.test(val)) return null;
      return val;
    }
  }
  return null;
}

function findEntityByRole(entities: RdapEntity[] | undefined, role: string): RdapEntity | null {
  if (!entities) return null;
  for (const entity of entities) {
    if (entity.roles?.includes(role)) return entity;
    const nested = findEntityByRole(entity.entities, role);
    if (nested) return nested;
  }
  return null;
}

function eventDate(events: RdapResponse['events'], action: string): string | undefined {
  const match = events?.find((e) => e.eventAction === action);
  return match?.eventDate;
}

function formatStatus(status: string): string {
  return status
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function parseRdap(
  inputDomain: string,
  queriedDomain: string,
  data: RdapResponse,
): DomainRegistration {
  const registrarEntity = findEntityByRole(data.entities, 'registrar');
  const registrantEntity = findEntityByRole(data.entities, 'registrant');

  const registrar = vcardField(registrarEntity?.vcardArray, 'fn')
    ?? vcardField(registrarEntity?.vcardArray, 'org');

  const registrantRaw = vcardField(registrantEntity?.vcardArray, 'fn')
    ?? vcardField(registrantEntity?.vcardArray, 'org');

  const hasRegistrantRole = registrantEntity != null;
  const registrantRedacted = hasRegistrantRole && !registrantRaw;

  return {
    domain: data.ldhName?.toLowerCase() ?? queriedDomain,
    queriedDomain: inputDomain,
    found: true,
    registrar: registrar ?? undefined,
    registrant: registrantRaw ?? undefined,
    registrantRedacted: registrantRedacted || undefined,
    status: data.status?.map(formatStatus),
    registeredAt: eventDate(data.events, 'registration'),
    expiresAt: eventDate(data.events, 'expiration'),
    updatedAt: eventDate(data.events, 'last changed'),
  };
}

function candidateDomains(domain: string): string[] {
  const candidates = [domain];
  const labels = domain.split('.');
  if (labels.length > 2) {
    candidates.push(labels.slice(1).join('.'));
  }
  return [...new Set(candidates)];
}

async function getRdapBootstrap(): Promise<RdapBootstrap> {
  if (bootstrapCache) return bootstrapCache;
  const response = await fetch(RDAP_BOOTSTRAP_URL, { headers: RDAP_HEADERS });
  if (!response.ok) throw new Error(`RDAP bootstrap returned ${response.status}`);
  bootstrapCache = await response.json() as RdapBootstrap;
  return bootstrapCache;
}

/** Resolve authoritative RDAP URL via IANA bootstrap (avoids rdap.org 403 in Workers). */
function resolveRdapUrl(domain: string, bootstrap: RdapBootstrap): string | null {
  const labels = domain.toLowerCase().split('.');
  for (let i = 0; i < labels.length - 1; i++) {
    const tld = labels.slice(i + 1).join('.');
    for (const [tlds, urls] of bootstrap.services) {
      if (tlds.includes(tld) && urls[0]) {
        const base = urls[0].endsWith('/') ? urls[0] : `${urls[0]}/`;
        return `${base}domain/${encodeURIComponent(domain)}`;
      }
    }
  }
  return null;
}

async function fetchRdapFromUrl(url: string): Promise<RdapResponse | null> {
  const response = await fetch(url, {
    headers: RDAP_HEADERS,
    redirect: 'follow',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`RDAP returned ${response.status}`);
  }

  const data = await response.json() as RdapResponse;
  if (data.errorCode) return null;
  return data;
}

async function fetchRdap(domain: string): Promise<RdapResponse | null> {
  const bootstrap = await getRdapBootstrap();
  const bootstrapUrl = resolveRdapUrl(domain, bootstrap);
  if (bootstrapUrl) {
    try {
      const data = await fetchRdapFromUrl(bootstrapUrl);
      if (data) return data;
    } catch {
      // fall through to rdap.org
    }
  }

  const fallbackUrl = `${RDAP_ORG_BASE}/${encodeURIComponent(domain)}`;
  return fetchRdapFromUrl(fallbackUrl);
}

/** Fetch domain registration metadata via RDAP (registrar, dates, registrant when public). */
export async function lookupDomainRegistration(input: string): Promise<DomainRegistration> {
  const normalized = normalizeDomainName(input);
  if (!normalized) {
    return { domain: input, queriedDomain: input, found: false, error: 'Invalid domain' };
  }

  for (const candidate of candidateDomains(normalized)) {
    try {
      const data = await fetchRdap(candidate);
      if (data) return parseRdap(normalized, candidate, data);
    } catch {
      // try next candidate
    }
  }

  return {
    domain: normalized,
    queriedDomain: normalized,
    found: false,
    error: 'Registration data not available for this domain',
  };
}
