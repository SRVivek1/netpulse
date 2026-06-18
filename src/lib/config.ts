import type { SiteConfig, FeatureFlags, AppConfig } from '../types/config';
import rawSite from '../../config/site.json';
import rawFlags from '../../config/feature-flags.json';

const site = rawSite as SiteConfig;
const flags = rawFlags as FeatureFlags;

/**
 * Returns the full site config — only call server-side (Astro frontmatter
 * or API routes). Secrets are stripped in getPublicConfig().
 */
export function getSiteConfig(): SiteConfig {
  return site;
}

export function getFeatureFlags(): FeatureFlags {
  return flags;
}

/**
 * Public-safe config sent to the browser via /api/config.
 * Strips clientId, API keys, and analytics tokens.
 */
export function getPublicConfig(): AppConfig {
  const { clientId: _cid, ...adsPublic } = site.ads;
  const { token: _tok, ...analyticsPublic } = site.analytics;

  // Strip apiKey from each map provider
  const safeProviders = Object.fromEntries(
    Object.entries(site.maps.providers).map(([k, v]) => {
      const { apiKey: _key, ...rest } = v;
      return [k, rest];
    })
  );

  return {
    features: flags.features,
    site: site.site,
    ads: adsPublic,
    analytics: analyticsPublic,
    maps: { ...site.maps, providers: safeProviders },
    speedTest: site.speedTest,
    doh: site.doh,
    serviceStatus: site.serviceStatus,
  };
}

/** Sorted list of enabled features for nav rendering. */
export function getEnabledFeatures() {
  return Object.entries(flags.features)
    .filter(([, f]) => f.enabled)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, f]) => ({ id, ...f }));
}
