'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DivIcon, LatLngExpression, LayerGroup, Map, TileLayer, TileLayerOptions } from 'leaflet';
import {
  Globe2, Info, LocateFixed, MapPin, Navigation, RefreshCw, Shield,
} from 'lucide-react';
import type { IpData } from '../../../types/api';
import type { AppConfig } from '../../../types/config';
import {
  antipode, formatDistanceKm, GPS_IP_MISMATCH_KM, haversineKm, type LatLon,
} from '../../../lib/geo';
import { cn, countryFlag, formatCoords, formatLocation } from '../../../lib/utils';
import { Badge } from '../../ui/Badge';
import { CopyButton } from '../../ui/CopyButton';

const FALLBACK_PROVIDER = 'carto';

const GPS_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

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

interface Props {
  ipData: IpData;
  appConfig: AppConfig;
  className?: string;
  style?: React.CSSProperties;
  /** When true, omits the location text header (shown in GEO bento tile instead). */
  compact?: boolean;
}

export function GeoMapPanel({ ipData, appConfig, className, style, compact = false }: Props) {
  const [visible, setVisible] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [gps, setGps] = useState<LatLon | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'loading' | 'denied' | 'error'>('idle');
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import('leaflet').default | null>(null);
  const usingFallbackTilesRef = useRef(false);
  const tileErrorCountRef = useRef(0);
  const skipNextAutoFitRef = useRef(false);
  const appConfigRef = useRef(appConfig);
  appConfigRef.current = appConfig;

  const browserTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setVisible(true); },
      { rootMargin: '100px', threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasGeo = ipData.latitude != null && ipData.longitude != null;
  const ipPoint = useMemo((): LatLon | null => {
    if (ipData.latitude == null || ipData.longitude == null) return null;
    return { lat: ipData.latitude, lon: ipData.longitude };
  }, [ipData.latitude, ipData.longitude]);
  const antipodePoint = useMemo(
    () => (ipPoint ? antipode(ipPoint.lat, ipPoint.lon) : null),
    [ipPoint],
  );

  const gpsDistanceKm = useMemo(() => {
    if (!ipPoint || !gps) return null;
    return haversineKm(ipPoint, gps);
  }, [ipPoint, gps]);

  const timezoneMismatch = Boolean(
    ipData.timezone && browserTimezone && ipData.timezone !== browserTimezone,
  );

  const handleGpsError = useCallback((err: GeolocationPositionError) => {
    skipNextAutoFitRef.current = false;
    setGpsStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error');
    setGpsMessage(
      err.code === err.PERMISSION_DENIED
        ? 'Location permission denied — showing IP-based location only.'
        : err.message || 'Could not read GPS position.',
    );
  }, []);

  const fetchGps = useCallback((
    onSuccess: (coords: LatLon) => void,
  ) => {
    if (!navigator.geolocation) {
      skipNextAutoFitRef.current = false;
      setGpsStatus('error');
      setGpsMessage('Geolocation is not supported in this browser.');
      return;
    }
    setGpsStatus('loading');
    setGpsMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setGps(coords);
        setGpsStatus('idle');
        onSuccess(coords);
      },
      handleGpsError,
      GPS_OPTIONS,
    );
  }, [handleGpsError]);

  const requestGps = () => {
    fetchGps(() => {});
  };

  const zoomToPosition = useCallback((pos: LatLon) => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    map.setView([pos.lat, pos.lon], map.getMaxZoom());
  }, []);

  const zoomToMyLocation = useCallback(() => {
    if (!mapRef.current || !mapReady) return;

    if (gps) {
      zoomToPosition(gps);
      return;
    }

    skipNextAutoFitRef.current = true;
    fetchGps((coords) => {
      requestAnimationFrame(() => zoomToPosition(coords));
    });
  }, [gps, mapReady, fetchGps, zoomToPosition]);

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
    options?: { fitView?: boolean },
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

    const shouldFit = options?.fitView !== false && !skipNextAutoFitRef.current;
    if (skipNextAutoFitRef.current) {
      skipNextAutoFitRef.current = false;
    }
    if (shouldFit) {
      if (bounds.length === 1) {
        map.setView(bounds[0]!, 10);
      } else if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 12 });
      }
    }
  }, []);

  useEffect(() => {
    if (!visible || !hasGeo || tilesFailed || !mapContainerRef.current) return;
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

        window.setTimeout(() => {
          if (cancelled || usingFallbackTilesRef.current || tilesLoaded > 0) return;
          swapToFallbackTiles(L, map);
        }, 2500);
      });
    };

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
  }, [visible, hasGeo, appConfig, tilesFailed, swapToFallbackTiles, placeMarkers, ipPoint]);

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    placeMarkers(leafletRef.current, mapRef.current, ipPoint, antipodePoint, gps);
  }, [ipPoint?.lat, ipPoint?.lon, gps?.lat, gps?.lon, placeMarkers, ipPoint, antipodePoint, gps]);

  useEffect(() => {
    if (!visible || !mapRef.current) return;
    requestAnimationFrame(() => mapRef.current?.invalidateSize());
  }, [visible]);

  const flag = countryFlag(ipData.country);
  const location = formatLocation(ipData.city, ipData.region, ipData.countryName ?? ipData.country);
  const coordText = formatCoords(ipData.latitude, ipData.longitude);
  const antipodeText = antipodePoint
    ? formatCoords(antipodePoint.lat, antipodePoint.lon)
    : '—';

  return (
    <div ref={panelRef} className={cn(compact ? 'space-y-3' : 'space-y-4', className)} style={style}>
      {!compact && (
      <div className="np-card px-4 py-4 animate-fade-up">
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
      )}

      {/* Map or fallback */}
      {hasGeo && !tilesFailed ? (
        <div className="animate-fade-up relative np-card p-1" style={{ '--delay': '0.04s' } as React.CSSProperties}>
          <div
            ref={mapContainerRef}
            className="geo-map-container h-[280px] lg:h-[340px]"
            aria-label="Geolocation map"
          />
          {!mapReady && visible && (
            <div className="absolute inset-1 flex items-center justify-center bg-[var(--np-map-bg)]/80 rounded-lg pointer-events-none">
              <RefreshCw size={20} className="text-np-faint animate-spin" />
            </div>
          )}
          {mapReady && (
            <button
              type="button"
              className="geo-map-locate-btn"
              onClick={zoomToMyLocation}
              disabled={gpsStatus === 'loading'}
              aria-label="Zoom to my location"
              title="Zoom to my location"
            >
              {gpsStatus === 'loading' ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <LocateFixed size={16} />
              )}
            </button>
          )}
          <div className="flex flex-wrap gap-4 mt-3 px-3 pb-2">
            <LegendItem colorClass="bg-violet-500" label="IP geolocation" />
            <LegendItem colorClass="bg-amber-500" label="Antipode" />
            {gps && <LegendItem colorClass="bg-emerald-400" label="Browser GPS" />}
          </div>
        </div>
      ) : (
        <div className="np-card px-4 py-8 text-center animate-fade-up">
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
        className="np-card px-4 py-4 animate-fade-up"
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
          className="np-card px-4 py-4 animate-fade-up"
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
