export interface IpData {
  ip: string;
  ipVersion: 'IPv4' | 'IPv6';
  asn: number | null;
  asnOrg: string | null;
  colo: string | null;
  city: string | null;
  region: string | null;
  regionCode: string | null;
  country: string | null;
  countryName: string | null;
  postalCode: string | null;
  continent: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  httpProtocol: string | null;
  tlsVersion: string | null;
  tlsCipher: string | null;
  clientTcpRtt: number | null;
  requestPriority: string | null;
  clientAcceptEncoding: string | null;
  isEU: boolean;
  servedAt: string;
}
