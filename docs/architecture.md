# Architecture Guide

Reference document for understanding, maintaining, and extending NetPulse.

---

## Overview

NetPulse is a server-side rendered (SSR) multi-tool network diagnostics platform. It runs as a Cloudflare Worker at the edge, which gives it direct access to Cloudflare's network metadata (geolocation, ASN, connection type) without any external API calls or databases.

**Tech stack at a glance:**

| Layer | Technology |
|-------|-----------|
| Meta-framework | Astro 5 (SSR mode) |
| UI components | React 19 + TypeScript |
| Styling | Tailwind CSS 3 |
| Runtime | Cloudflare Workers (edge) |
| Deployment | Wrangler CLI / Cloudflare Pages |
| Build tool | Vite 6 (via Astro) |

---

## System Architecture

```
Browser
  │
  │  HTTP Request
  ▼
┌──────────────────────────────────────┐
│          Cloudflare Edge Network     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     Cloudflare Worker          │  │
│  │   (Astro SSR entry point)      │  │
│  │                                │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │   Static asset handler   │  │  │
│  │  │  (JS, CSS, fonts, icons) │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │   Astro page renderer    │  │  │
│  │  │   /  →  index.astro      │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │   API route handlers     │  │  │
│  │  │   /api/ip                │  │  │
│  │  │   /api/dns               │  │  │
│  │  │   /api/ping              │  │  │
│  │  │   /api/upload            │  │  │
│  │  │   /api/config            │  │  │
│  │  └──────────────────────────┘  │  │
│  └────────────────────────────────┘  │
│                                      │
│  request.cf  ←  CF edge metadata     │
│  (IP, geo, ASN, connection info)     │
└──────────────────────────────────────┘
```

The key architectural insight: because the app runs **on** the Cloudflare edge, it reads network metadata from the incoming request object (`request.cf`) directly — no external geolocation API, no database, no secrets needed for core functionality.

---

## Request Lifecycle

### 1. Page Request (`GET /`)

```
Browser → CF Edge Worker
  → Astro SSR: renders index.astro
      → reads config/feature-flags.json (at build time, embedded in the page)
      → renders Shell.astro layout (sidebar, header, font links)
      → renders all feature panel slots (hidden via CSS)
      → injects inline icon SVG definitions
      → injects client-side router script
  → Returns full HTML page
Browser receives HTML
  → DOMContentLoaded fires
  → router.ts runs: reads URL hash, shows matching panel
  → React hydrates the active feature component
```

### 2. API Request (`GET /api/ip`)

```
Browser (React component) → fetch('/api/ip')
  → CF Edge Worker
  → src/pages/api/ip.ts handler
      → reads request.cf (Cloudflare injects this for all edge requests)
      → reads X-Forwarded-For / CF-Connecting-IP headers
      → assembles IpData object
  → Returns JSON response
React component receives data → renders IP info cards
```

### 3. Navigation (client-side)

```
User clicks sidebar item
  → router.ts: window.location.hash = '#feature_id'
  → hashchange event fires
  → router shows the matching panel div, hides others
  → (no server round-trip)
```

---

## Module Map

### `src/pages/`

The Astro file-based router. Every `.astro` and `.ts` file here maps directly to a URL.

| File | Route | Role |
|------|-------|------|
| `index.astro` | `/` | Full dashboard shell + all feature panels |
| `api/ip.ts` | `/api/ip` | Returns IP + Cloudflare geo metadata |
| `api/ping.ts` | `/api/ping` | Minimal endpoint for latency probing |
| `api/config.ts` | `/api/config` | Returns public-safe site config |

### `src/layouts/`

| File | Role |
|------|------|
| `Shell.astro` | Root HTML template. Loads fonts, sets dark theme, renders sidebar + header + main content slot. All pages use this layout. |

### `src/components/`

Split into three sub-categories:

**`features/`** — One directory per feature. Each feature is a self-contained React component that:
- Fetches its own data via the relevant `/api/*` endpoint
- Manages its own loading/error state
- Renders into the panel slot assigned by `index.astro`

**`ui/`** — Shared primitive components with no business logic:

| Component | Props | Use |
|-----------|-------|-----|
| `Card` | `className?` | Bordered panel container |
| `CardHeader` | `title, subtitle?, action?` | Card title row |
| `CardBody` | `className?` | Card content area with padding |
| `DataRow` | `label, value, mono?` | Key-value display row |
| `Badge` | `variant, children` | Color-coded status chip |
| `CopyButton` | `value, size?` | Copies text, shows ✓ feedback |

**Root components** — `Header.astro`, `Sidebar.astro`. These are Astro (not React) because they render once at SSR time and need no client-side interactivity.

### `src/lib/`

| File | Exports | Role |
|------|---------|------|
| `config.ts` | `loadConfig()`, `getPublicConfig()` | Loads and merges `site.json` + `feature-flags.json`; strips private fields before exposing via `/api/config` |
| `router.ts` | (IIFE, no exports) | Client-side hash router. Reads `data-panel-id` attributes, toggles visibility on `hashchange` |
| `utils.ts` | `cn()`, `copyToClipboard()`, `formatCoords()` | `cn()` wraps `clsx` + `tailwind-merge`; other small helpers |

### `src/types/`

TypeScript interfaces shared across the app:

| File | Types |
|------|-------|
| `api.ts` | `IpData`, `DnsResult`, `DnsFullResult`, `SpeedTestResult`, `DomainRegistration` — API response shapes |
| `config.ts` | `SiteConfig`, `FeatureFlag`, `AppConfig` — shape of config files |

### `config/`

JSON-driven configuration that controls behavior without code changes:

**`site.json`** — Static metadata:
- Site name, tagline, URL
- Ad slot IDs (Google AdSense)
- Analytics IDs (Google Analytics)
- Maps API key
- Default DNS server

**`feature-flags.json`** — Feature manifest:
- `id` — used as the URL hash and panel `data-panel-id`
- `label` — sidebar display name
- `icon` — Lucide icon name (injected as inline SVG)
- `enabled` — whether the feature appears in the sidebar
- `order` — sidebar sort order
- `status` — `stable` | `beta` | `coming_soon`

---

## Data Flow

### IP Discovery

```
IpDiscovery.tsx mounts
  │
  ├── useState: data=null, loading=true, error=null
  │
  ├── useEffect: fetch('/api/ip')
  │     │
  │     │  [on CF edge]
  │     ├── api/ip.ts reads request.cf
  │     │     ├── cf.ip or X-Forwarded-For header
  │     │     ├── cf.asn, cf.asOrganization
  │     │     ├── cf.city, cf.region, cf.country
  │     │     ├── cf.latitude, cf.longitude
  │     │     ├── cf.timezone
  │     │     └── cf.httpProtocol, cf.tlsVersion
  │     └── Returns JSON: IpData
  │
  ├── setData(json), setLoading(false)
  │
  └── Renders:
        ├── Skeleton cards (loading=true)
        └── Data cards with DataRow, Badge, CopyButton (loading=false)
```

### DNS Resolver

```
DnsResolver.tsx — user submits domain or IP
  │
  ├── Check sessionStorage cache (60s TTL, key: np-dns:full:<name>)
  │
  ├── fetch('/api/dns?name=<query>')
  │     │
  │     │  [on CF edge]
  │     ├── api/dns.ts validates input (RFC 1123 / IP)
  │     ├── Proxies to DoH (Cloudflare primary, Google fallback)
  │     ├── For domains: parallel RDAP registration lookup
  │     └── Returns JSON: DnsFullResult
  │
  ├── writeCache(), setResult()
  │
  └── Renders:
        ├── Per-type record cards (A, AAAA, MX, …)
        ├── DNSSEC AD badge, resolver badge
        └── Domain registration card (RDAP)
```

### Speed Test

```
SpeedTest.tsx — user selects preset and starts test
  │
  ├── Phase A: measurePing() — HEAD /api/ping (8×, 2 warmup)
  │
  ├── Phase B: measureDownload() — 4 parallel GET /speed/chunk-*.bin
  │     ├── HTTP Range header sized per preset
  │     └── Static assets — zero Worker CPU
  │
  ├── Phase C: measureUpload() — POST /api/upload
  │     └── api/upload.ts stream-discards body via getReader()
  │
  └── Renders canvas gauge + ping/download/upload result cards
```

### Config Loading

```
Build time (or SSR request time):
  config.ts:loadConfig()
    ├── reads config/site.json
    ├── reads config/feature-flags.json
    └── returns AppConfig

  index.astro:
    ├── calls loadConfig()
    ├── embeds enabled features as JSON in a <script> tag
    └── renders sidebar items from feature list

  api/config.ts:
    ├── calls loadConfig()
    ├── calls getPublicConfig() — strips apiKey, clientId, tokens
    └── returns JSON (safe for browser consumption)
```

---

## Routing Architecture

NetPulse uses a **hybrid routing** approach:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Server-side | Astro file router | URL paths → page/API handlers |
| Client-side | Vanilla JS hash router | Hash fragment → panel visibility |

The client-side router (`src/lib/router.ts`) works by:
1. On `DOMContentLoaded`: read `window.location.hash` (e.g., `#speed_test`)
2. Find all `[data-panel-id]` elements
3. Show the one whose `data-panel-id` matches the hash, hide all others
4. Listen for `hashchange` events to handle navigation
5. Default to the first enabled feature if no hash is set

This means all panels are rendered in the SSR HTML but toggled with `display: none`. React only hydrates the active panel on first interaction.

---

## Styling System

### Design Tokens (tailwind.config.cjs)

```
Colors:
  surface   → #111318  (main panel background)
  elevated  → #1a1d24  (raised panels, cards)
  hover     → #1f2330  (hover state)
  active    → #252a3a  (active/pressed state)

Background:
  #0a0c0f (near-black, app root)

Fonts:
  font-sans     → DM Sans (body text)
  font-display  → Syne (headings, logo)
  font-mono     → JetBrains Mono (IPs, codes, values)
```

### Animation Classes (global.css)

| Class | Effect |
|-------|--------|
| `.animate-fade-up` | Entrance: fade in + slide up |
| `.animate-shimmer` | Loading skeleton shimmer |
| `.animate-pulse-dot` | Status indicator pulse |
| `[data-stagger-index]` | Staggered entrance delay via CSS custom property |

---

## Adding a New Feature — Architecture Checklist

When implementing one of the planned features (speed test, DNS resolver, etc.), follow this pattern:

1. **Config** (`config/feature-flags.json`): set `enabled: true` on the feature entry.

2. **API route** (`src/pages/api/<feature>.ts`): define a typed `APIRoute` handler. Access CF bindings via `context.locals.runtime.env`.

3. **Types** (`src/types/api.ts`): add a response interface (e.g., `SpeedTestResult`).

4. **Feature component** (`src/components/features/<feature>/`):
   - One React component per feature
   - Use `useState` + `useEffect` + `fetch` for data loading
   - Use skeleton loading pattern (render `<DataRow>` with empty value while loading)
   - Use `Card`, `CardHeader`, `CardBody`, `DataRow`, `Badge` for layout
   - Handle errors gracefully with a visible error state

5. **Register** (`src/pages/index.astro`): add to the feature-ID → component mapping.

---

## Security Considerations

- **No authentication**: NetPulse is a public read-only tool.
- **Config secret stripping**: `getPublicConfig()` in `src/lib/config.ts` explicitly removes `apiKey`, `clientId`, `measurementId`, and similar fields before exposing config via `/api/config`. When adding new secrets to `site.json`, add them to the strip list.
- **No user data stored**: the app is stateless — no database, no cookies, no sessions.
- **CORS**: Not configured. All requests originate from the same origin.
- **Cache headers**: Defined in `public/_headers`. API routes that return user-specific data (like `/api/ip`) must not be cached at the edge level — verify `_headers` excludes them.

---

## Performance Architecture

| Technique | Where | Effect |
|-----------|-------|--------|
| SSR HTML with inline config | `index.astro` | No config API call on first load |
| All panels pre-rendered | `index.astro` | No layout shift on panel switch |
| Inline SVG icon paths | `index.astro` `<script>` | Zero icon fetch requests |
| React hydration only on active panel | `router.ts` | Minimal initial JS execution |
| CSS skeleton loading | Feature components | Perceived performance |
| Staggered CSS entrance animations | Feature components | Perceived polish |
| Edge caching | `public/_headers` | Static assets cached at CF PoP |

---

## Planned Features (from feature-flags.json)

| Feature ID | Label | Status |
|------------|-------|--------|
| `ip_discovery` | IP & Location | Implemented (includes embedded geolocation map, antipode pin, GPS vs IP) |
| `dns_resolver` | DNS Lookup | Implemented |
| `speed_test` | Speed Test | Implemented |
| `service_status` | Service Status | Planned |
| `webrtc_leak` | WebRTC Leak | Beta / Planned |
| `http_headers` | HTTP Headers | Beta / Planned |
| `dns_propagation` | DNS Propagation | Disabled (beta) |
| `ssl_cert` | SSL / TLS | Disabled (beta) |
| `email_deliverability` | Email / MX | Disabled (beta) |
| `bgp_route` | BGP Route | Disabled (beta) |

> **Note:** Geolocation map (Feature 2), antipode pin (Feature 16), and GPS vs IP compare (Feature 15) ship inside the `ip_discovery` panel — there is no standalone `geolocation_map` sidebar item.

---

## Key Files Quick Reference

| File | Change it when... |
|------|-------------------|
| `config/feature-flags.json` | Toggling/reordering features, adding feature metadata |
| `config/site.json` | Changing branding, API keys, ad slots, analytics |
| `src/pages/api/ip.ts` | Adding/removing fields from the IP response |
| `src/pages/api/dns.ts` | DNS lookup proxy and response shape |
| `src/lib/dns.ts` | DoH client, record types, input validation |
| `src/lib/whois.ts` | RDAP domain registration lookups |
| `src/lib/speed.ts` | Ping/download/upload measurement logic |
| `src/pages/api/upload.ts` | Upload speed test stream-discard handler |
| `scripts/generate-speed-chunks.mjs` | Build-time speed test binary generator |
| `src/lib/config.ts` | Adding a new secret field that must be stripped from public config |
| `src/layouts/Shell.astro` | Changing the page chrome (fonts, layout, global scripts) |
| `tailwind.config.cjs` | Adding design tokens, custom colors, or fonts |
| `public/_headers` | Changing Cloudflare edge cache rules |
| `wrangler.jsonc` | Adding CF bindings (KV, D1, R2), changing compatibility date |
