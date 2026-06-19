import type { APIRoute } from 'astro';
import {
  detectIpVersion,
  normalizeAsOrg,
  parseCoord,
  isEdgeDataUnavailable,
} from '../../lib/ip';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const cf = (request as any).cf ?? {};

  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  const asn = cf.asn ?? null;
  const asnOrg = normalizeAsOrg(cf.asOrganization);
  const edgeDataAvailable = !isEdgeDataUnavailable(ip, asn, cf.colo);

  const payload = {
    ip,
    ipVersion: detectIpVersion(ip),
    asn,
    asnOrg,
    colo:             cf.colo              ?? null,
    city:             cf.city              ?? null,
    region:           cf.region            ?? null,
    regionCode:       cf.regionCode        ?? null,
    country:          cf.country           ?? null,
    countryName:      cf.countryName       ?? null,
    postalCode:       cf.postalCode        ?? null,
    continent:        cf.continent         ?? null,
    timezone:         cf.timezone          ?? null,
    latitude:         parseCoord(cf.latitude),
    longitude:        parseCoord(cf.longitude),
    httpProtocol:     cf.httpProtocol      ?? null,
    tlsVersion:       cf.tlsVersion        ?? null,
    tlsCipher:        cf.tlsCipher         ?? null,
    clientTcpRtt:     cf.clientTcpRtt      ?? null,
    requestPriority:  cf.requestPriority   ?? null,
    clientAcceptEncoding: cf.clientAcceptEncoding ?? null,
    isEU:             cf.isEUCountry === '1',
    edgeDataAvailable,
    servedAt:         new Date().toISOString(),
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
