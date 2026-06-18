import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
  const cf = (request as any).cf ?? {};

  const ip =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  const lat = cf.latitude != null ? parseFloat(cf.latitude) : null;
  const lon = cf.longitude != null ? parseFloat(cf.longitude) : null;

  const payload = {
    ip,
    ipVersion: ip.includes(':') ? 'IPv6' : 'IPv4',
    asn:              cf.asn               ?? null,
    asnOrg:           cf.asOrganization    ?? null,
    colo:             cf.colo              ?? null,
    city:             cf.city              ?? null,
    region:           cf.region            ?? null,
    regionCode:       cf.regionCode        ?? null,
    country:          cf.country           ?? null,
    countryName:      cf.countryName       ?? null,
    postalCode:       cf.postalCode        ?? null,
    continent:        cf.continent         ?? null,
    timezone:         cf.timezone          ?? null,
    latitude:         lat,
    longitude:        lon,
    httpProtocol:     cf.httpProtocol      ?? null,
    tlsVersion:       cf.tlsVersion        ?? null,
    tlsCipher:        cf.tlsCipher         ?? null,
    clientTcpRtt:     cf.clientTcpRtt      ?? null,
    requestPriority:  cf.requestPriority   ?? null,
    clientAcceptEncoding: cf.clientAcceptEncoding ?? null,
    isEU:             cf.isEUCountry === '1',
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
