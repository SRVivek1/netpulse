export interface FeatureFlag {
  enabled: boolean;
  beta: boolean;
  order: number;
  label: string;
  icon: string;
}

export interface FeatureFlags {
  features: Record<string, FeatureFlag>;
}

export interface AdSlot {
  enabled: boolean;
  slotId: string;
  format: string;
  responsive: boolean;
}

export interface SiteConfig {
  site: {
    name: string;
    tagline: string;
    description: string;
    version: string;
    defaultFeature: string;
  };
  ads: {
    enabled: boolean;
    provider: string;
    clientId: string;
    slots: Record<string, AdSlot>;
  };
  analytics: {
    enabled: boolean;
    provider: string;
    token: string;
  };
  maps: {
    tileProvider: string;
    providers: Record<string, {
      url: string;
      attribution: string;
      maxZoom: number;
      subdomains?: string;
      apiKey?: string;
    }>;
  };
  speedTest: {
    downloadStreams: number;
    defaultPreset: 'standard' | 'fast' | 'gigabit';
    presets: Record<'standard' | 'fast' | 'gigabit', {
      label: string;
      chunkSizeMB: number;
      description: string;
    }>;
    assetsPath: string;
    uploadSizeMB: number;
    pingCount: number;
    pingWarmupCount: number;
    autoPreset: {
      probeSizeMB: number;
      thresholdsMbps: { fast: number; gigabit: number };
      reuseLastResultMs: number;
    };
  };
  doh: { primary: string; fallback: string };
  serviceStatus: {
    services: Array<{ name: string; url: string; icon: string }>;
    timeoutMs: number;
  };
}

export type AppConfig = Pick<SiteConfig,
  'site' | 'maps' | 'speedTest' | 'doh' | 'serviceStatus'
> & {
  ads: Omit<SiteConfig['ads'], 'clientId'>;
  analytics: Omit<SiteConfig['analytics'], 'token'>;
  features: Record<string, FeatureFlag>;
};

export interface LatencyGlossaryEntry {
  term: string;
  label: string;
  description: string;
}

export interface LatencyTileCopy {
  title: string;
  summary: string;
  measuring: string;
  footer: string;
  helpTitle: string;
  glossary: LatencyGlossaryEntry[];
}

export interface WebsiteCoreConfig {
  ipDiscovery: {
    sections: { exploreConnection: string; advancedDetails: string };
    tiles: Record<string, { title: string }> & {
      latency: LatencyTileCopy;
    };
  };
}
