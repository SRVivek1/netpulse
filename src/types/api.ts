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

export interface DnsAnswer {
  name: string;
  type: number;
  typeName: string;
  ttl: number;
  data: string;
}

export interface DnsResult {
  query: string;
  type: string;
  status: number;
  statusText: string;
  dnssecAuthenticated: boolean;
  answers: DnsAnswer[];
  authority: DnsAnswer[];
  resolver: 'primary' | 'fallback';
  servedAt: string;
}

export interface DnsSection {
  type: string;
  status: number;
  statusText: string;
  dnssecAuthenticated: boolean;
  records: DnsAnswer[];
}

export interface DnsFullResult {
  query: string;
  inputKind: 'domain' | 'ip';
  sections: DnsSection[];
  resolver: 'primary' | 'fallback';
  registration?: DomainRegistration;
  servedAt: string;
}

export interface DomainRegistration {
  domain: string;
  queriedDomain: string;
  found: boolean;
  error?: string;
  registrar?: string;
  registrant?: string;
  registrantRedacted?: boolean;
  status?: string[];
  registeredAt?: string;
  expiresAt?: string;
  updatedAt?: string;
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

export type SpeedPresetId = 'standard' | 'fast' | 'gigabit';

export interface PingResult {
  latencyMs: number;
  jitterMs: number;
  samples: number[];
}

export interface TransferResult {
  mbps: number;
  bytesTransferred: number;
  durationMs: number;
}

export interface SpeedTestResult {
  ping: PingResult;
  download: TransferResult;
  upload: TransferResult;
  preset: SpeedPresetId;
  completedAt: string;
}
