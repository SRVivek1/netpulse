'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DivIcon, LatLngExpression, LayerGroup, Map, TileLayer, TileLayerOptions } from 'leaflet';
import {
  AlertTriangle, Globe2, Info, LocateFixed, MapPin, Navigation, RefreshCw, Shield,
} from 'lucide-react';
import type { IpData } from '../../../types/api';
import type { AppConfig } from '../../../types/config';
import {
  antipode, formatDistanceKm, GPS_IP_MISMATCH_KM, haversineKm, type LatLon,
} from '../../../lib/geo';
import {
  countryFlag, fetchWithTimeout, formatCoords, formatLocation,
} from '../../../lib/utils';
import { Badge } from '../../ui/Badge';
import { CopyButton } from '../../ui/CopyButton';

const FEATURE_ID = 'geolocation_map';
const FALLBACK_PROVIDER = 'carto';

function isPanelActive(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash.slice(1);
  if (hash === FEATURE_ID) return true;
  if (hash) return false;
  const panel = document.getElementById(`panel-${FEATURE_ID}`);
  return panel?.style.display !== 'none';
}

function GeoSkeleton() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="skeleton h-28 rounded-xl" />
      <div className="skeleton h-[420px] rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    </div>
  );
}

function GeoError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="max-w-md mx-auto flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="size-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center">
        <AlertTriangle className="text-red-400" size={24} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-np font-display font-semibold text-lg">Couldn&apos;t load location</p>
        <p className="font-mono text-[0.75rem] text-np-muted mt-1">{message}</p>
      </div>
      <button onClick={onRetry} className="cta-primary">Try again</button>
    </div>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.72rem] text-np-muted">
      <span className={`size-2.5 rounded-full border border-white/70 ${colorClass}`} />
      {label}
    </span>
  );
}

function createTileLayer(
  L: typeof import('leaflet').default,
  provider: AppConfig['maps']['providers'][string],
): TileLayer {
  const options: TileLayerOptions = {
    attribution: provider.attribution,
    maxZoom: provider.maxZoom,
  };
  if (provider.subdomains) {
    options.subdomains = provider.subdomains;
  }
  return L.tileLayer(provider.url, options);
}

function divMarker(L: typeof import('leaflet').default, className: string): DivIcon {
  return L.divIcon({
    className: '',
    html: `<div class="${className}"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export default function GeolocationMap() {
  const [ipData, setIpData] = useState<IpData | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelActive, setPanelActive] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [gps, setGps] = useState<LatLon | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle');
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet').default | null>(null);
  const usingFallbackTilesRef = useRef(false);
  const tileErrorCountRef = useRef(0);
  const appConfigRef = useRef(appConfig);
  appConfigRef.current = appConfig;

  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ipRes, cfgRes] = await Promise.all([
        fetchWithTimeout('/api/ip', {}, 10_000),
        fetchWithTimeout('/api/config', {}, 10_000),
      ]);
      if (!ipRes.ok) throw new Error(`IP API HTTP ${ipRes.status}`);
      if (!cfgRes.ok) throw new Error(`Config API HTTP ${cfgRes.status}`);
      setIpData(await ipRes.json());
      setAppConfig(await cfgRes.json());
    } catch (e) {
      const msg = e instanceof DOMException && e.name === 'AbortError'
        ? 'Request timed out — try again'
        : e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sync = () => setPanelActive(isPanelActive());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const hasGeo = ipData?.latitude != null && ipData?.longitude != null;
  const ipPoint = useMemo((): LatLon | null => {
    if (ipData?.latitude == null || ipData?.longitude == null) return null;
    return { lat: ipData.latitude, lon: ipData.longitude };
  }, [ipData?.latitude, ipData?.longitude]);
  const antipodePoint = useMemo(
    () => (ipPoint ? antipode(ipPoint.lat, ipPoint.lon) : null),
    [ipPoint],
  );

  const gpsDistanceKm = useMemo(() => {
    if (!ipPoint || !gps) return null;
    return haversineKm(ipPoint, gps);
  }, [ipPoint, gps]);

  const timezoneMismatch = Boolean(
    ipData?.timezone && browserTimezone && ipData.timezone !== browserTimezone,
  );

  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsMessage('Geolocation is not supported in this browser.');
      return;
    }
    setGpsStatus('loading');
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGpsStatus('idle');
      },
      (err) => {
        setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
        setGpsMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — showing IP-based location only.'
            : err.message || 'Could not read GPS position.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const swapToFallbackTiles = useCallback((
    L: typeof import('leaflet').default,
    map: Map,
  ) => {
    const config = appConfigRef.current;
    if (!config || usingFallbackTilesRef.current) {
      setTilesFailed(true);
      return;
    }
    const fallback = config.maps.providers[FALLBACK_PROVIDER];
    if (!fallback) {
      setTilesFailed(true);
      return;
    }
    usingFallbackTilesRef.current = true;
    tileErrorCountRef.current = 0;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const layer = createTileLayer(L, fallback);
    layer.on('tileerror', () => {
      tileErrorCountRef.current += 1;
      if (tileErrorCountRef.current >= 8) setTilesFailed(true);
    });
    layer.addTo(map);
    tileLayerRef.current = layer;
    map.invalidateSize();
  }, []);

  const placeMarkers = useCallback((
    L: typeof import('leaflet').default,
    map: Map,
    ip: LatLon | null,
    anti: LatLon | null,
    gpsPos: LatLon | null,
  ) => {
    if (markersLayerRef.current) {
      map.removeLayer(markersLayerRef.current);
    }
    const group = L.layerGroup();
    const bounds: LatLngExpression[] = [];

    if (ip) {
      L.marker([ip.lat, ip.lon], { icon: divMarker(L, 'geo-marker-ip') })
        .bindPopup('IP geolocation (approximate)')
        .addTo(group);
      bounds.push([ip.lat, ip.lon]);
    }
    if (anti) {
      L.marker([anti.lat, anti.lon], { icon: divMarker(L, 'geo-marker-antipode') })
        .bindPopup('Antipode — opposite side of Earth')
        .addTo(group);
      bounds.push([anti.lat, anti.lon]);
    }
    if (gpsPos) {
      L.marker([gpsPos.lat, gpsPos.lon], { icon: divMarker(L, 'geo-marker-gps') })
        .bindPopup('Browser GPS')
        .addTo(group);
      bounds.push([gpsPos.lat, gpsPos.lon]);
    }

    group.addTo(map);
    markersLayerRef.current = group;

    if (bounds.length === 1) {
      map.setView(bounds[0]!, 10);
    } else if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 12 });
    }
  }, []);

  // Initialise map once when panel is shown — stable deps only.
  useEffect(() => {
    if (!panelActive || !hasGeo || !appConfig || tilesFailed || !mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    tileErrorCountRef.current = 0;
    usingFallbackTilesRef.current = false;

    const initMap = () => {
      if (cancelled || !mapContainerRef.current || mapRef.current) return;

      void import('leaflet').then(({ default: L }) => {
        if (cancelled || !mapContainerRef.current || mapRef.current) return;

        const primaryId = appConfig.maps.tileProvider;
        const primary = appConfig.maps.providers[primaryId];
        if (!primary) {
          setTilesFailed(true);
          return;
        }

        leafletRef.current = L;
        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: true,
        });
        mapRef.current = map;

        const layer = createTileLayer(L, primary);
        let tilesLoaded = 0;
        layer.on('tileload', () => { tilesLoaded += 1; });
        layer.on('tileerror', () => {
          if (usingFallbackTilesRef.current) {
            tileErrorCountRef.current += 1;
            if (tileErrorCountRef.current >= 8) setTilesFailed(true);
            return;
          }
          tileErrorCountRef.current += 1;
          if (tileErrorCountRef.current >= 6) swapToFallbackTiles(L, map);
        });
        layer.addTo(map);
        tileLayerRef.current = layer;

        const ip = ipPoint;
        const anti = ip ? antipode(ip.lat, ip.lon) : null;
        placeMarkers(L, map, ip, anti, null);

        map.whenReady(() => {
          if (cancelled) return;
          map.invalidateSize();
          setMapReady(true);
        });

        // If primary provider serves no tiles (e.g. 401 placeholders), swap after brief wait.
        window.setTimeout(() => {
          if (cancelled || usingFallbackTilesRef.current || tilesLoaded > 0) return;
          swapToFallbackTiles(L, map);
        }, 2500);
      });
    };

    // Wait for panel layout after display:none → block transition.
    requestAnimationFrame(() => requestAnimationFrame(initMap));

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      leafletRef.current = null;
      usingFallbackTilesRef.current = false;
      tileErrorCountRef.current = 0;
      setMapReady(false);
    };
  }, [panelActive, hasGeo, appConfig, tilesFailed, swapToFallbackTiles, placeMarkers, ipPoint]);

  // Update markers without tearing down the map.
  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    placeMarkers(leafletRef.current, mapRef.current, ipPoint, antipodePoint, gps);
  }, [ipPoint?.lat, ipPoint?.lon, gps?.lat, gps?.lon, placeMarkers, ipPoint, antipodePoint, gps]);

  // Leaflet mis-measures size when the panel was display:none.
  useEffect(() => {
    if (!panelActive || !mapRef.current) return;
    const map = mapRef.current;
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
  }, [panelActive]);

  if (loading) return <GeoSkeleton />;
  if (error || !ipData || !appConfig) {
    return <GeoError message={error ?? 'No data'} onRetry={load} />;
  }

  const flag = countryFlag(ipData.country);
  const location = formatLocation(ipData.city, ipData.region, ipData.countryName ?? ipData.country);
  const coordText = formatCoords(ipData.latitude, ipData.longitude);
  const antipodeText = antipodePoint
    ? formatCoords(antipodePoint.lat, antipodePoint.lon)
    : '—';

  return (
    <div className="max-w-3xl mx-auto pb-8">

      {!ipData.edgeDataAvailable && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 animate-fade-up">
          <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[0.78rem] text-amber-200/80 leading-relaxed">
            Edge data unavailable in local dev. Deploy to Cloudflare preview or production for real geo coordinates.
          </p>
        </div>
      )}

      {/* Location header */}
      <div className="rounded-xl border border-np bg-[var(--np-overlay)] px-4 py-4 mb-4 animate-fade-up">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={14} className="text-violet-400/80" />
          <p className="text-[0.68rem] uppercase tracking-[0.12em] font-semibold text-np-faint">
            Approximate location
          </p>
        </div>
        <p className="text-[1rem] text-np mb-1">
          {flag && <span className="mr-1.5">{flag}</span>}
          {location !== 'Location unavailable' ? location : 'Location unavailable'}
          {ipData.postalCode ? ` · ${ipData.postalCode}` : ''}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-mono text-[0.78rem] text-np-muted">
            {hasGeo ? coordText : 'Coordinates unavailable'}
            {ipData.timezone ? ` · ${ipData.timezone}` : ''}
          </p>
          {hasGeo && <CopyButton text={coordText} />}
        </div>
        <p className="text-[0.68rem] text-np-faint mt-2 leading-relaxed">
          Approximate location based on IP — city-level accuracy, often off by 50–200 km.
        </p>
      </div>

      {/* Map or fallback */}
      {hasGeo && !tilesFailed ? (
        <div className="mb-4 animate-fade-up relative" style={{ '--delay': '0.04s' } as React.CSSProperties}>
          <div
            ref={mapContainerRef}
            className="geo-map-container h-[420px] border border-np"
            aria-label="Geolocation map"
          />
          {!mapReady && panelActive && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--np-map-bg)]/80 rounded-xl pointer-events-none">
              <RefreshCw size={20} className="text-np-faint animate-spin" />
            </div>
          )}
          <div className="flex flex-wrap gap-4 mt-3 px-1">
            <LegendItem colorClass="bg-violet-500" label="IP geolocation" />
            <LegendItem colorClass="bg-amber-500" label="Antipode" />
            {gps && <LegendItem colorClass="bg-emerald-400" label="Browser GPS" />}
          </div>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-np bg-[var(--np-overlay)] px-4 py-8 text-center animate-fade-up">
          <Globe2 size={28} className="mx-auto text-np-faint mb-3" />
          <p className="text-[0.88rem] text-np-muted mb-1">
            {hasGeo ? 'Map tiles unavailable' : 'Location unavailable on map'}
          </p>
          <p className="text-[0.72rem] text-np-muted max-w-sm mx-auto">
            {hasGeo
              ? 'Showing coordinates as text. Tile providers may be rate-limited or blocked.'
              : 'IP geolocation coordinates are missing — common with VPNs, Tor, or local development.'}
          </p>
          {hasGeo && (
            <p className="font-mono text-[0.78rem] text-np-muted mt-3">{coordText}</p>
          )}
        </div>
      )}

      {/* GPS compare */}
      <div
        className="rounded-xl border border-np bg-[var(--np-overlay)] px-4 py-4 mb-4 animate-fade-up"
        style={{ '--delay': '0.08s' } as React.CSSProperties}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Navigation size={14} className="text-emerald-400/80" />
            <p className="text-[0.82rem] font-semibold text-np">GPS vs IP compare</p>
          </div>
          {!gps && gpsStatus !== 'loading' && (
            <button onClick={requestGps} className="cta-primary text-[0.78rem] py-2 px-3">
              <LocateFixed size={14} />
              Enable GPS to compare
            </button>
          )}
          {gpsStatus === 'loading' && (
            <span className="text-[0.72rem] text-np-muted flex items-center gap-1.5">
              <RefreshCw size={13} className="animate-spin" /> Requesting location…
            </span>
          )}
        </div>

        {gpsMessage && (
          <p className="text-[0.72rem] text-np-muted mb-3">{gpsMessage}</p>
        )}

        {gps && ipPoint && gpsDistanceKm != null && (
          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.76rem] text-np-muted">GPS coordinates</span>
              <span className="font-mono text-[0.78rem] text-np">
                {formatCoords(gps.lat, gps.lon)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.76rem] text-np-muted">Distance from IP pin</span>
              <span className="font-mono text-[0.78rem] text-np">
                {formatDistanceKm(gpsDistanceKm)}
              </span>
            </div>
            {gpsDistanceKm > GPS_IP_MISMATCH_KM && (
              <div className="flex items-start gap-2 pt-1">
                <Badge variant="orange">
                  <Shield size={10} /> VPN / proxy signal
                </Badge>
                <p className="text-[0.72rem] text-np-muted leading-relaxed">
                  GPS is more than {GPS_IP_MISMATCH_KM} km from IP geolocation — your connection may be routed or masked.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-baseline justify-between gap-4 py-2 border-t border-np">
          <span className="text-[0.76rem] text-np-faint">Browser timezone</span>
          <span className="text-[0.78rem] font-mono text-np">{browserTimezone ?? '—'}</span>
        </div>
        <div className="flex items-baseline justify-between gap-4 py-2">
          <span className="text-[0.76rem] text-np-faint">IP timezone</span>
          <span className="text-[0.78rem] font-mono text-np">{ipData.timezone ?? '—'}</span>
        </div>
        {timezoneMismatch && (
          <p className="text-[0.72rem] text-orange-300/70 mt-2 flex items-start gap-1.5">
            <Info size={12} className="shrink-0 mt-0.5" />
            Timezone mismatch — browser ({browserTimezone}) differs from IP geo ({ipData.timezone}).
          </p>
        )}
      </div>

      {/* Antipode */}
      {antipodePoint && (
        <div
          className="rounded-xl border border-np bg-[var(--np-overlay)] px-4 py-4 animate-fade-up"
          style={{ '--delay': '0.12s' } as React.CSSProperties}
        >
          <div className="flex items-center gap-2 mb-2">
            <Globe2 size={14} className="text-amber-400/80" />
            <p className="text-[0.82rem] font-semibold text-np">Antipode</p>
          </div>
          <p className="text-[0.78rem] text-np-muted mb-2 leading-relaxed">
            The point on the opposite side of Earth from your IP geolocation pin.
          </p>
          <div className="flex items-center gap-2">
            <p className="font-mono text-[0.78rem] text-np-muted">{antipodeText}</p>
            <CopyButton text={antipodeText} />
          </div>
        </div>
      )}
    </div>
  );
}
