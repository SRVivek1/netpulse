export interface ProxyDetection {
  detected: boolean;
  signals: string[];
  chain: string[];
  headers: Record<string, string>;
}

export interface ConnectionRisk {
  level: 'low' | 'medium' | 'high';
  label: string;
  reasons: string[];
}

export interface IpData {
  ip: string;
  ipVersion: 'IPv4' | 'IPv6' | 'unknown';
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
  edgeDataAvailable: boolean;
  headers: Record<string, string>;
  proxy: ProxyDetection;
  connectionRisk: ConnectionRisk;
  servedAt: string;
}
