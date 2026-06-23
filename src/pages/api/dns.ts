import type { APIRoute } from 'astro';
import { getSiteConfig } from '../../lib/config';
import {
  dnsTypeCode,
  isDnsRecordType,
  normalizeFullLookupName,
  normalizeQueryName,
  recordTypesForInputKind,
  type DnsRecordType,
} from '../../lib/dns';
import type { DnsAnswer, DnsFullResult, DnsResult, DnsSection } from '../../types/api';
import { lookupDomainRegistration } from '../../lib/whois';

export const prerender = false;

const DNS_STATUS: Record<number, string> = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
};

const TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
};

interface DohRecord {
  name?: string;
  type?: number;
  TTL?: number;
  data?: string;
}

interface DohResponse {
  Status?: number;
  AD?: boolean;
  Answer?: DohRecord[];
  Authority?: DohRecord[];
}

function mapRecords(records: DohRecord[] | undefined): DnsAnswer[] {
  if (!records?.length) return [];
  return records
    .filter((record) => record.name && record.type != null && record.data != null)
    .map((record) => ({
      name: record.name!.replace(/\.$/, ''),
      type: record.type!,
      typeName: TYPE_NAMES[record.type!] ?? `TYPE${record.type}`,
      ttl: record.TTL ?? 0,
      data: String(record.data),
    }));
}

async function queryDoh(
  endpoint: string,
  name: string,
  type: DnsRecordType,
): Promise<DohResponse> {
  const url = new URL(endpoint);
  url.searchParams.set('name', name);
  url.searchParams.set('type', String(dnsTypeCode(type)));

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/dns-json' },
  });

  if (!response.ok) {
    throw new Error(`DoH upstream returned ${response.status}`);
  }

  return response.json() as Promise<DohResponse>;
}

async function queryWithFallback(
  primary: string,
  fallback: string,
  name: string,
  type: DnsRecordType,
): Promise<{ data: DohResponse; resolver: DnsResult['resolver'] }> {
  try {
    return { data: await queryDoh(primary, name, type), resolver: 'primary' };
  } catch {
    return { data: await queryDoh(fallback, name, type), resolver: 'fallback' };
  }
}

function toSection(
  type: DnsRecordType,
  data: DohResponse,
): DnsSection {
  const status = data.Status ?? 2;
  const answers = mapRecords(data.Answer);
  const authority = mapRecords(data.Authority);
  return {
    type,
    status,
    statusText: DNS_STATUS[status] ?? `RCODE${status}`,
    dnssecAuthenticated: data.AD === true,
    records: [...answers, ...authority],
  };
}

async function fullLookup(
  queryName: string,
  inputKind: DnsFullResult['inputKind'],
  primary: string,
  fallback: string,
): Promise<DnsFullResult> {
  const types = recordTypesForInputKind(inputKind);
  let resolver: DnsFullResult['resolver'] = 'primary';

  const [sections, registration] = await Promise.all([
    Promise.all(
      types.map(async (type) => {
        const result = await queryWithFallback(primary, fallback, queryName, type);
        if (result.resolver === 'fallback') resolver = 'fallback';
        return toSection(type, result.data);
      }),
    ),
    inputKind === 'domain'
      ? lookupDomainRegistration(queryName).catch(() => ({
          domain: queryName,
          queriedDomain: queryName,
          found: false,
          error: 'Registration lookup unavailable',
        }))
      : Promise.resolve(undefined),
  ]);

  return {
    query: queryName,
    inputKind,
    sections,
    resolver,
    ...(registration ? { registration } : {}),
    servedAt: new Date().toISOString(),
  };
}

function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const rawName = url.searchParams.get('name') ?? '';
  const rawType = url.searchParams.get('type')?.toUpperCase() ?? 'ALL';

  const { doh } = getSiteConfig();

  if (rawType === 'ALL') {
    const normalized = normalizeFullLookupName(rawName);
    if (!normalized) {
      return jsonError('Invalid domain or IP address');
    }

    try {
      const payload = await fullLookup(normalized.query, normalized.kind, doh.primary, doh.fallback);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    } catch {
      return jsonError('DNS resolver unavailable', 502);
    }
  }

  if (!isDnsRecordType(rawType)) {
    return jsonError(`Unsupported record type: ${rawType}`);
  }

  const queryName = normalizeQueryName(rawName, rawType);
  if (!queryName) {
    return jsonError('Invalid domain or IP address');
  }

  try {
    const { data, resolver } = await queryWithFallback(doh.primary, doh.fallback, queryName, rawType);
    const status = data.Status ?? 2;
    const payload: DnsResult = {
      query: queryName,
      type: rawType,
      status,
      statusText: DNS_STATUS[status] ?? `RCODE${status}`,
      dnssecAuthenticated: data.AD === true,
      answers: mapRecords(data.Answer),
      authority: mapRecords(data.Authority),
      resolver,
      servedAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return jsonError('DNS resolver unavailable', 502);
  }
};
