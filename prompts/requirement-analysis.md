# Requirement Analysis: All-in-One Network Intelligence Hub

**Date:** 2026-06-19  
**Platform Target:** Cloudflare Pages + Pages Functions  
**Stack:** Astro 6 SSR + React 19 + TypeScript + Tailwind CSS + Leaflet.js — no traditional backend, no database

---

## Executive Summary

NetPulse (Network Intelligence Hub) is architecturally sound and buildable entirely on Cloudflare Pages with the specified constraints. The project has **no traditional backend application** — all features must use one of three data buckets: browser-native Web APIs (Bucket A), Cloudflare edge metadata via Pages Functions (Bucket B), or free public APIs proxied from the edge with SSRF guards (Bucket C).

Feature 1 (IP & ASN Discovery) is **shipped**. The remaining original five core features are feasible with documented design corrections. Competitive research against [InfoByIp.com](https://www.infobyip.com/) identified nine adoptable feature additions (Features 14–22) that fit the client-first architecture, plus a clear skip list (traceroute, port scanning, dev minifiers).

Privacy and legal obligations are manageable without significant friction when `request.cf` is preferred over external geo APIs for the visitor's own session. A phased build strategy (Phase 0–5) prioritizes MVP launch with the original five sidebar tools, then InfoByIp homepage parity, then privacy/developer tools, then free API lookup tools.

**Cost policy:** NetPulse is designed to run entirely on **Cloudflare Workers Free** ($0/month) and **free public APIs** — no paid Cloudflare subscription, no paid third-party API keys, and no features that require Workers Paid, Durable Objects, or enterprise-only Cloudflare products.

---

## Guiding Principle — Data Buckets

| Bucket | Source | Examples |
|---|---|---|
| **A — Browser-native** | Client JS / Web APIs | WebRTC leak, WebGL/GPU fingerprint, geolocation, network calculator, service reachability |
| **B — Edge-native** | Cloudflare `request.cf` + Pages Functions | IP/ASN/geo, TLS, incoming headers, DoH proxy, speed-test endpoints |
| **C — Free public APIs** | Proxied from edge with SSRF guards | crt.sh, BGPView, RIPE Stat, Open-Meteo, multi-resolver DoH |

**Explicitly out of scope:** traceroute, MTR, TCP/FTP/SSH port scanning, IP bulk lookup, HTML/JS minifiers and encoders, databases, authentication, **paid APIs**, **paid Cloudflare tiers**, Durable Objects, and enterprise-only Cloudflare features (`botManagement`, etc.).

```
Browser (Bucket A)          Cloudflare Edge (Bucket B)         Free APIs (Bucket C)
─────────────────          ──────────────────────────         ────────────────────
WebRTC, WebGL, GPS    ←→   /api/ip  (request.cf)        ←→   BGPView, crt.sh
Network calculator         /api/dns (DoH proxy)               RIPE Stat, Open-Meteo
no-cors reachability       /api/ping, /api/upload (stream)    Multi-resolver DoH
Speed test download        /speed/*.bin (static assets)
```

---

## Free Tier & Zero-Cost Policy

NetPulse **does not require a paid Cloudflare subscription** for any planned feature. The entire roadmap is constrained to Cloudflare Workers/Pages **Free** ($0) plus free/public external services.

### Cloudflare Free — what you get at $0

| Resource | Free limit | NetPulse impact |
|---|---|---|
| Requests | 100,000/day | Speed test uses ~9 Worker calls (8 pings + 1 upload). **Download uses static assets — unlimited, no Worker quota.** |
| CPU time | 10 ms per HTTP request | Applies to `/api/ping` and `/api/upload` only. **Download has zero Worker CPU** — served as static files. |
| Wall-clock time | 30 s per request | Upload/download tests complete within this window. |
| Memory | 128 MB | Stream-read upload; never buffer full body. |
| Subrequests | 50 per invocation | DNS propagation (5–8 DoH resolvers) and email checker (4–5 queries) fit comfortably. |
| `request.cf` geo/ASN/TLS | Included on Free | Core IP/geo/ASN features — no MaxMind or ip-api.com needed. |
| Static assets | Unlimited requests | JS, CSS, fonts served free; only Functions count toward 100k/day. |
| Custom domain | Free (on Cloudflare DNS) | No Pro/Business plan required. |

**When you'd need Workers Paid ($5/mo):** Only at scale beyond ~100k Function requests/day (ping + upload only for speed tests). Download static assets do not count. NetPulse does **not** plan for this.

**Cloudflare products NOT used (all paid or enterprise):** Durable Objects, Bot Management, Argo Smart Routing, Workers TCP outbound (port scanning), Video Stream, R2.

### External services — free only, no API keys required

| Service | Cost | Used for | Notes |
|---|---|---|---|
| Cloudflare / Google DoH | Free | DNS, PTR, propagation, email checks | Rate-limit politely |
| `request.cf` | Free (with CF hosting) | IP, geo, ASN, TLS for visitor | No external geo API |
| BGPView API | Free, no key | Arbitrary IP lookup, BGP route | Cache in sessionStorage |
| RIPE Stat API | Free, no key | BGP, WHOIS/RDAP proxy | Same |
| crt.sh | Free, no key | SSL/TLS cert history | Can be slow under load |
| Open-Meteo | Free, no key | Weather widget | Send lat/lon only, not user IP |
| Stadia Maps tiles | Free tier (~200k tiles/mo) | Map dark tiles | Carto fallback if cap hit |

**Explicitly excluded paid/third-party options:**
- ip-api.com, ipinfo.io, MaxMind GeoIP — use `request.cf` + BGPView instead
- SSL Labs API — too slow; use crt.sh
- Stadia paid tier / Mapbox / Google Maps — not needed

### Free-tier design mitigations (build requirements)

1. **Speed test download:** Pre-generated high-entropy `.bin` files in `public/speed/` (built at `npm run build`, gitignored). Served as **static assets** — zero Worker CPU, unlimited requests. See Feature 3 download architecture below.
2. **Speed test upload:** `request.body.getReader()` discard loop only — minimal CPU.
3. **Client-side rate limiting:** Optional cooldown between speed tests (e.g. 30s) to reduce bandwidth abuse.
4. **DNS cache:** `sessionStorage` 60s TTL — reduces DoH subrequests and Worker invocations.
5. **Map tiles:** Stadia primary; fall back to coordinates-as-text if tile cap exceeded.
6. **VPN detection:** Heuristic-only (ASN keywords + proxy headers + GPS delta) — **no ip-api.com**.

All Features 1–22, WHOIS, and weather remain in scope on the free tier. Already-skipped items (traceroute, port scan) were skipped for technical/abuse reasons, not cost.

---

## Implementation Status

| Feature | Status | Key Files |
|---|---|---|
| Feature 1 — IP & ASN Discovery | **Complete** | `src/pages/api/ip.ts`, `src/lib/ip.ts`, `src/lib/browser.ts`, `src/components/features/ip/*` |
| Features 2–13 | Planned / ComingSoon | `src/pages/index.astro` (`IMPLEMENTED` set) |
| Features 14–22 | Documented, not started | This document |
| `/api/ping` | Stub only | `src/pages/api/ping.ts` |
| `/api/config` | Shipped | `src/pages/api/config.ts` |

**Feature 1 design corrections already applied:**
- Honest IPv4/IPv6 **connection protocol** badge (not false "Dual-Stack" on every IPv6 visit)
- Dedicated ISP/ASN monospace block in hero card
- `edgeDataAvailable` dev banner when `request.cf` is empty locally
- Datacenter/VPN heuristic disclaimer via `isLikelyDatacenter()`
- Public-facing UX with cross-feature CTA cards and collapsible advanced details

---

## Feature-by-Feature Feasibility Analysis

### Feature 1 — Advanced IP & ASN Discovery Module

**Feasibility: HIGH** | **Bucket: B + A** | **Status: Complete**

| Aspect | Status |
|---|---|
| `CF-Connecting-IP` header | Available in all Pages Functions environments |
| `request.cf.asn` | Available in production and preview |
| `request.cf.asOrganization` | Available in production and preview |
| Local dev (`wrangler pages dev`) | `request.cf` is mostly empty — stubs only |

**Shipped capabilities:**
- Public IP hero card with copy + refresh
- IPv4/IPv6 connection protocol badge
- ISP / ASN monospace network identity block
- Connection risk badge (VPN/proxy/datacenter heuristic + proxy headers + timezone mismatch)
- Approximate geo summary with accuracy disclaimer
- IP neighbourhood (/24, IPv4 only)
- Quick stats: TLS, Edge PoP, latency, continent
- Cross-feature CTAs
- Advanced panel: connection details, incoming request headers, browser fingerprint (WebGL/GPU, capabilities)

**Technical Notes:**
- `latitude` and `longitude` are strings (not numbers) — `"37.7749"` not `37.7749`. Parser required before passing to Leaflet. Implemented in `parseCoord()`.
- `city`, `region`, `postalCode` can be `undefined` for VPN/proxy IPs, datacenter IPs, and some regional ISPs with incomplete MaxMind coverage.
- The original prompt's "IPv4/IPv6 Dual Stack" badge is **revised**: a single connection reveals only the protocol in use (IPv4 or IPv6). True dual-stack detection requires a future optional client-side probe to separate IPv4 and IPv6 endpoints (Phase 5).

**Risks:**
- Low — this is the simplest feature in the set.
- `asOrganization` may return raw RIR text like `"GOOGLE"` or `"AS-CHOOPA"` — format defensively. Implemented in `normalizeAsOrg()`.

**Implemented Notes:**
- `detectIpVersion()` in `src/lib/ip.ts` handles IPv4-mapped addresses (`::ffff:x.x.x.x`) and returns `'unknown'` for invalid IPs.
- `normalizeAsOrg()` title-cases ALL-CAPS RIR strings (e.g. `"GOOGLE LLC"` → `"Google LLC"`).
- `isEdgeDataUnavailable()` drives the local-dev amber banner.
- `isLikelyDatacenter()` triggers VPN/proxy/datacenter disclaimer copy.
- Connection badge shows **"IPv4 connection"** or **"IPv6 connection"** — not a misleading dual-stack indicator.
- Extended `/api/ip` response includes TLS, HTTP protocol, geo, and `edgeDataAvailable` for downstream features.

---

### Feature 2 — High-Precision Geolocation Map Module

**Feasibility: HIGH (with caveats)** | **Bucket: B + A** | **Status: Planned**

**Technical Notes:**
- Leaflet.js with Stadia Maps (`alidade_smooth_dark`) is the primary tile provider — configured in `config/site.json`. 200k tile requests/month free, no API key needed.
- CartoDB Dark Matter as fallback. Attribution required: `© OpenStreetMap contributors © CARTO`.
- CartoDB tile URL: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Bundle **Feature 16 (Antipode pin)** at launch — opposite Earth point as second map marker.
- Bundle **Feature 15 (GPS vs IP compare)** — browser geolocation overlay when user grants permission.

**Risks:**
- CARTO tile availability under heavy traffic: Medium. Mitigate with Stadia Maps as primary.
- Geo accuracy: IP geolocation is city-level at best, often off by 50–200km. Add disclaimer ("Approximate location based on IP").
- `latitude`/`longitude` undefined for some users (VPN, Tor, certain proxies): Requires fallback UI state (show "Location unavailable" rather than crashing).

---

### Feature 3 — Real-Time Network Speed Test Engine

**Feasibility: HIGH** | **Bucket: A + B (static + edge)** | **Status: Planned**

#### Phase A: Ping & Jitter
- 8 successive `HEAD` requests to `/api/ping`; discard first 2 as warmup (configured in `config/site.json` `speedTest.pingCount` / `pingWarmupCount`).
- Jitter as mean absolute deviation of sequential RTTs is standard.
- InfoByIp's "Internet connection check" is a lighter ping-only variant — NetPulse's full speed test supersedes this.

#### Phase B: Download — static assets (resolved architecture)

**Decision:** Serve download test data as **pre-generated static binary files** on Cloudflare Pages — not a Worker stream (`/api/download` removed from design).

| Aspect | Detail |
|---|---|
| Why static | Static asset requests are **free and unlimited** on Pages; **zero Worker CPU** (avoids 10 ms free-tier limit entirely). |
| What it measures | User → nearest Cloudflare edge (same model as fast.com and Cloudflare Speed Test). |
| File location | `public/speed/chunk-{1..N}.bin` — generated at build time, **gitignored** (not committed). |
| Per-file limit | **25 MiB max per file** (Cloudflare Pages hard limit). Total deploy can exceed 25 MB as long as each file ≤ 25 MiB. |
| Parallel streams | 4 concurrent fetches to **separate URLs** (`chunk-1.bin` … `chunk-4.bin`) to saturate fast connections. |
| Cache control | `Cache-Control: no-store` on `/speed/*` in `public/_headers` + client `?r=<uuid>` cache-bust param. |
| File content | High-entropy bytes (build script uses PRNG once locally — incompressible, prevents middlebox compression skew). |

**Download presets** (user-selectable in UI, configured in `config/site.json`):

| Preset | Chunk size | Streams | Total transfer | Target connections |
|---|---|---|---|---|
| **Standard** | 5 MB | 4 | 20 MB | Up to ~100 Mbps |
| **Fast** | 12 MB | 4 | 48 MB | 100–500 Mbps |
| **Gigabit** | 25 MB | 4 | 100 MB | 500 Mbps–1 Gbps+ |

At 1 Gbps, 100 MB completes in ~0.8 s — sufficient for a stable reading. At 500 Mbps, ~1.6 s. Standard preset keeps deploy size modest (~20 MB of binaries) for faster builds.

**Build pipeline:**
```
npm run build
  → scripts/generate-speed-chunks.ts  (or .js)
  → writes public/speed/chunk-{1..4}.bin at each preset size (or one set at max 25 MB reused with Range — prefer separate files per stream)
  → astro build copies to dist/speed/
```

**Risks and mitigations:**

| Risk | Severity | Mitigation |
|---|---|---|
| Browser cache reuses prior test file | Medium | `no-store` headers + `?r=uuid` on every fetch |
| Edge CDN caches static file | Low | Acceptable — speed tests intentionally measure edge proximity; cache-bust param forces revalidation |
| Deploy size (~100 MB for gigabit preset) | Low | Files gitignored; generated in CI/build only. Well within Pages limits (20k files, 25 MiB/file). |
| Repo bloat if bins committed | Medium | Add `public/speed/*.bin` to `.gitignore` |
| Single 25 MiB file limit blocks one giant file | Low | Use 4 × 25 MiB files for gigabit preset |
| R2 suggested by CF for >25 MiB single file | N/A | Not needed — 25 MiB per chunk is enough |

**Validation — your understanding is correct:** Static files on your own Pages site is the best free-tier choice. Upload stays on Worker (stream discard). Ping stays on Worker (204 response). Download bypasses Worker entirely.

#### Phase C: Upload
- `Uint8Array` random data in browser (prevents compression spoofing).
- POST to `/api/upload`; Worker **stream-reads and discards** via `request.body.getReader()` — never buffer fully in memory.
- 5MB upload default (`config/site.json` `speedTest.uploadSizeMB`).

**Gauge UI:**
- Canvas-based gauges or custom `requestAnimationFrame` implementation.
- Preset selector (Standard / Fast / Gigabit) above the start button.
- Avoid Chart.js for gauges — no true speedometer support.

---

### Feature 4 — Edge-Accelerated DNS Resolver Tool

**Feasibility: HIGH** | **Bucket: B** | **Status: Planned**

- Cloudflare Pages Functions proxy to `https://cloudflare-dns.com/dns-query` with `Accept: application/dns-json`. Fallback: Google DoH (`config/site.json` `doh`).
- Input sanitization: Validate domain names against RFC 1123 regex before forwarding.
- Supported record types: A, AAAA, MX, TXT, CNAME, NS, SOA.
- **Feature 20 (Reverse DNS / PTR):** Include PTR lookups via DoH at launch.
- Surface DNSSEC `AD` (Authenticated Data) flag from DoH JSON response.
- Cache DNS results in `sessionStorage` with 60-second TTL.

**Risks:**
- Unusual automated query patterns may trigger DoH throttling.
- DNS injection via unsanitized input — validate domain regex before forwarding.

---

### Feature 5 — Live Services Reachability Status Matrix

**Feasibility: MEDIUM — architectural correction required** | **Bucket: A** | **Status: Planned**

**The core issue:** Direct browser `fetch()` to third-party origins is blocked by CORS for readable responses.

**Recommendation:** Client-side `mode: 'no-cors'` fetch with `AbortController` (~5s timeout per service). Measures the **user's actual network path**, not Cloudflare's. Supplement with `performance.now()` timing for latency estimation.

Services configured in `config/site.json` `serviceStatus.services`. Status indicators: Reachable (fast), Degraded (high latency), Unreachable (timeout/error).

**Risks:**
- No-cors mode returns opaque responses — green/yellow/red only, no HTTP status codes.
- Some services may rate-limit frequent anonymous requests.

---

## Competitive Analysis: InfoByIp.com

Research date: 2026-06-19. [InfoByIp.com](https://www.infobyip.com/) is a long-running network diagnostics site targeting software engineers and sysadmins. Its homepage combines IP detection, geolocation, weather, HTTP headers, and deep browser fingerprinting in a single page. Separate tools live under [Internet tools](https://www.infobyip.com/internettools.php).

### InfoByIp Homepage — Adopt vs Skip

| InfoByIp capability | NetPulse decision | Bucket | Maps to |
|---|---|---|---|
| Public IP + geo table | Adopt | B | Feature 1 + 2 |
| Leaflet map + antipode | Adopt | A | Feature 2 + 16 |
| Weather forecast | Adopt (Phase 4) | C | Open-Meteo add-on |
| Incoming HTTP headers | Adopt | B | Feature 18 |
| Deep client properties (WebGL, GPU, battery, plugins) | Adopt | A | Feature 14 |
| Browser geolocation test | Adopt | A | Feature 15 |
| IP neighbourhood (/24 block) | Adopt | A | Feature 17 |
| Proxy header detection | Adopt | A+B | Feature 19 |
| WebRTC / local IP | Adopt | A | Feature 6 |

### InfoByIp Separate Tools — Adopt vs Skip

| InfoByIp tool | NetPulse decision | Bucket | Maps to |
|---|---|---|---|
| DNS lookup | Adopt | B | Feature 4 |
| Reverse DNS (PTR) | Adopt | B | Feature 20 |
| Ping / connection check | Adopt (superseded) | B | Feature 3 |
| ISP/ASN/Location lookup (any IP) | Adopt | C | Feature 21 |
| Network calculator (CIDR) | Adopt | A | Feature 22 |
| Proxy detector | Adopt | A+B | Feature 11 + 19 |
| WHOIS | Adopt (Phase 4) | C | WHOIS flag |
| Traceroute / MTR | **Skip** | — | Requires raw ICMP/UDP sockets |
| TCP / FTP / SSH port scan | **Skip** | — | Abuse risk; Workers TCP limited |
| IP bulk lookup | **Skip** | — | Rate limits and abuse risk |
| HTML/JS minifiers, encoders | **Skip** | — | Out of product scope |

### NetPulse Differentiators vs InfoByIp

- Edge-native `request.cf` for visitor session — no MaxMind dependency for own IP/geo/ASN/TLS
- Modern public-facing UX with cross-feature CTAs (already in Feature 1)
- Full speed test (download + upload) vs InfoByIp's ping-only connection check
- Service reachability matrix — unique to NetPulse
- WebRTC leak test with structured results
- Skips low-value dev-tool clutter (minifiers, color pickers, encoders)

---

## Privacy & Legal Analysis

### GDPR (EU)

| Action | Classification | Risk | Mitigation |
|---|---|---|---|
| Displaying user's own IP | Legitimate interest / service delivery | Low | No action needed |
| Logging IP server-side | Personal data processing | Medium-High | Do not log IPs; use Cloudflare analytics only |
| Forwarding user IP to DoH (1.1.1.1) | Data transfer to third party | Low | Cloudflare already processes the request; disclose in privacy policy |
| Forwarding user IP to external geo APIs | Data transfer to third party | Medium | Avoid — use `request.cf` for visitor's own session |
| BGPView / RIPE Stat lookup (any IP) | User-initiated third-party query | Low-Medium | Disclose in privacy policy; user provides the IP |
| Open-Meteo weather (lat/lon) | Coordinates to third party | Low | Send coordinates only, not IP; disclose in privacy policy |
| Browser geolocation (GPS) | Sensitive data; requires consent | Medium | `navigator.geolocation` prompt; data stays client-side; compare locally to IP geo |

**Key principle:** For the visitor's own IP and geo, always prefer `request.cf` (Bucket B) over external geo APIs. This eliminates the main GDPR data-transfer concern for the core experience.

### EU ePrivacy Directive
- Does not apply to IP display tools.
- Applies if you add analytics cookies or tracking pixels. Cloudflare Web Analytics (cookie-free) is GDPR-exempt.

### CCPA (California)
- IP + geolocation = personal information under CCPA.
- Obligation only applies to "businesses" (>$25M revenue OR processes data of >100k consumers).
- A public-facing tool at scale: add a privacy policy disclosing that no data is stored.

### Third-Party Service ToS (Feature 5)
- HTTP requests to check reachability: Generally tolerated by major platforms.
- Do **not** fetch and render third-party page content — only check reachability and timing.
- Use a descriptive `User-Agent` like `NetPulse/1.0 (reachability-check)`.

### DNS-over-HTTPS Legal Notes
- No legal restrictions on Cloudflare 1.1.1.1 DoH or Google DoH for application queries.
- Some jurisdictions block DoH endpoints — connectivity issue, not a legal issue for the operator.

### WHOIS / RDAP Data
- GDPR has reduced personal data in WHOIS since 2018. RDAP returns mostly technical data (registrar, nameservers, dates).

---

## Technical Risks Summary

| Risk | Severity | Feature | Recommendation |
|---|---|---|---|
| `request.cf` fields undefined locally | Medium | 1, 2 | Test on Cloudflare preview, not `wrangler dev`; show dev banner |
| `lat`/`lon` undefined for VPN/proxy users | High | 2, 15 | Null checks; graceful fallback UI |
| Speed test download CPU exceeded | ~~High~~ **Resolved** | 3 | Static assets — no Worker CPU for download |
| Speed test too small for fast connections | Medium | 3 | Gigabit preset: 4×25 MB = 100 MB total transfer |
| Browser CORS blocks service reachability fetch | High | 5 | Use `no-cors` mode with `AbortController` |
| CARTO tiles under heavy load | Medium | 2 | Stadia Maps primary (already configured) |
| Upload endpoint: Worker memory overflow | Medium | 3 | Stream-read body, never buffer |
| DNS injection via unsanitized input | High | 4, 20 | Validate domain/IP regex before DoH forward |
| SSRF via headers/lookup proxy | High | 7, 21 | Block private IP ranges; HTTPS-only targets |
| BGPView / crt.sh rate limits | Medium | 13, 21 | Cache results; show rate-limit errors gracefully |
| Browser geolocation permission denied | Low | 15 | Show IP-only geo with "Enable GPS to compare" CTA |
| SSL cert inspection not possible natively | Medium | 9 | Use crt.sh CT Log API proxy |
| WebSocket stateful connections need Durable Objects | Medium | — | Use SSE for one-way streaming if needed |

---

## Proposed Features — Original Enhancements (6–13)

Based on competitive analysis of fast.com, speedtest.net, ipinfo.io, browserleaks.com, and mxtoolbox.com.

---

### Feature 6 — WebRTC IP Leak Detector

**Bucket: A** | **Feasibility: HIGH** | **Phase: 3** | **Flag: `webrtc_leak`**

Reveals IPs exposed via WebRTC ICE candidates — VPN leak detection, LAN IP exposure, IPv6 leak when VPN tunnels IPv4 only.

100% client-side. No Pages Function needed.

```js
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
pc.createDataChannel('');
pc.onicecandidate = (e) => { /* parse e.candidate.candidate for IPs */ };
pc.createOffer().then(o => pc.setLocalDescription(o));
```

**Caveat (2024+ browsers):** Chrome anonymizes LAN IPs with mDNS UUIDs (`abc.local`). Public IP still leaks via `srflx` candidates. Surface both.

---

### Feature 7 — HTTP Security Headers Analyzer

**Bucket: B + C** | **Feasibility: HIGH** | **Phase: 3** | **Flag: `http_headers`**

User enters a URL; Pages Function fetches response headers and grades HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.

**Risk:** SSRF — validate public HTTPS hostname; block private IP ranges.

---

### Feature 8 — DNS Propagation Checker

**Bucket: C** | **Feasibility: HIGH** | **Phase: 4** | **Flag: `dns_propagation`**

Fan-out DoH queries to Cloudflare, Google, Quad9, AdGuard, OpenDNS in parallel. Show which resolvers have the latest record.

Resolvers: `1.1.1.1`, `8.8.8.8`, `9.9.9.9`, `dns.adguard.com`, `doh.opendns.com`.

---

### Feature 9 — TLS/SSL Certificate Inspector

**Bucket: C + B** | **Feasibility: MEDIUM** | **Phase: 4** | **Flag: `ssl_cert`**

- Proxy to **crt.sh** (`https://crt.sh/?q=<domain>&output=json`) — free, instant, historical certs.
- Show live connection cert from `request.cf.tlsVersion` / `request.cf.tlsCipher` for user's own visit.
- Skip SSL Labs API (60–120s latency, strict rate limits).

---

### Feature 10 — Network Protocol & Connection Inspector

**Bucket: A + B** | **Feasibility: HIGH** | **Phase: 2** | **Partially shipped in Feature 1 advanced panel**

| Data Point | Source |
|---|---|
| HTTP version (HTTP/1.1 / HTTP/2 / HTTP/3) | `request.cf.httpProtocol` from `/api/ip` |
| TLS version + cipher suite | `request.cf.tlsVersion`, `request.cf.tlsCipher` |
| Estimated bandwidth | `navigator.connection.downlink` |
| Network type | `navigator.connection.effectiveType` |
| Round-trip time estimate | `navigator.connection.rtt` |
| Data saver mode | `navigator.connection.saveData` |
| Browser geolocation (if permitted) | `navigator.geolocation.getCurrentPosition()` |

Partially implemented in Feature 1 collapsible advanced panel. Full standalone panel optional in Phase 2.

---

### Feature 11 — VPN / Proxy / Tor Detection Badge

**Bucket: A + B** | **Feasibility: MEDIUM** | **Phase: 3** | **Extend `ip_discovery`**

Signals:
- ASN organization heuristic (`isLikelyDatacenter()` — already shipped)
- Proxy headers from Feature 19 (`Via`, `Forwarded`, `X-Forwarded-For` chain)
- Timezone mismatch (browser vs IP timezone)
- GPS vs IP distance delta (Feature 15)

**External APIs:** None. Free-tier policy requires heuristic-only detection (ASN keywords, proxy headers from Feature 19, GPS delta from Feature 15). ip-api.com is excluded.

---

### Feature 12 — Email Deliverability Checker (MX / SPF / DKIM / DMARC)

**Bucket: B** | **Feasibility: HIGH** | **Phase: 3** | **Flag: `email_deliverability`**

Parallel DoH queries: `MX`, `TXT` (SPF), `TXT _dmarc.<domain>`, `TXT default._domainkey.<domain>`. Reuses DNS infrastructure from Feature 4.

---

### Feature 13 — BGP / Route Lookup

**Bucket: C** | **Feasibility: MEDIUM** | **Phase: 4** | **Flag: `bgp_route`**

Proxy to BGPView or RIPE Stat (free, no key):
- `https://api.bgpview.io/ip/<ip>`
- `https://stat.ripe.net/data/routing-status/data.json?resource=<ip>`

Shows announced prefix, origin AS, upstreams, RPKI status.

---

## Proposed Features — InfoByIp-Inspired (14–22)

Based on competitive analysis of [InfoByIp.com](https://www.infobyip.com/) homepage and tool directory.

---

### Feature 14 — Browser Fingerprint Panel

**Bucket: A** | **Feasibility: HIGH** | **Phase: 2** | **Flag: `browser_info` (new)**

Deep client-side property detection:
- Parsed User-Agent: browser name/version, OS, device type (desktop/mobile/tablet)
- Screen: resolution, color depth, device pixel ratio, orientation
- WebGL: vendor, renderer, version; WebGPU support flag
- Battery API: level, charging state (where available)
- Feature detection grid: WebAssembly, WebRTC, Service Workers, IndexedDB, PDF viewer, touch support
- CPU cores, device memory (`navigator.hardwareConcurrency`, `navigator.deviceMemory`)

**Implementation:** 100% client-side. Extend Feature 1 advanced panel or standalone sidebar feature.

**Risks:** Battery API deprecated in some browsers; plugins list empty in modern Chrome. Gracefully show "Not available".

---

### Feature 15 — GPS vs IP Geolocation Compare

**Bucket: A + B** | **Feasibility: HIGH** | **Phase: 2** | **Part of `geolocation_map`**

Request `navigator.geolocation.getCurrentPosition()` and compare to `/api/ip` coordinates:
- Display both pins on Leaflet map
- Calculate haversine distance between GPS and IP geo
- Show VPN/proxy signal when delta > 50km
- Timezone mismatch: `Intl.DateTimeFormat` vs IP timezone from `/api/ip`

**Risks:** User must grant geolocation permission. Show IP-only fallback with "Enable GPS to compare" CTA.

---

### Feature 16 — Antipode Map Pin

**Bucket: A** | **Feasibility: HIGH** | **Phase: 1 (bundled with Feature 2)**

Calculate opposite point on Earth: `lat' = -lat`, `lon' = lon ± 180`. Second Leaflet marker with distinct styling. Pure math, no API.

InfoByIp shows antipode on homepage — low-effort parity win bundled into geolocation map launch.

---

### Feature 17 — IP Neighbourhood

**Bucket: A** | **Feasibility: HIGH** | **Phase: 2** | **Part of `ip_discovery`**

Show ±10 adjacent IP addresses in the same /24 block. Pure client-side integer math on IPv4. Display as monospace list with current IP highlighted.

**Risks:** Meaningless for IPv6 /128 addresses — show only for IPv4 or disable with explanation.

---

### Feature 18 — Incoming Request Headers

**Bucket: B** | **Feasibility: HIGH** | **Phase: 2** | **Extend `/api/ip`**

Echo sanitized incoming request headers for the current visit. Extend `/api/ip` response with a `headers` object or add `/api/headers/self`.

Exclude sensitive internal headers. Display in collapsible table on IP page.

InfoByIp shows full HTTP headers on homepage — high parity value, zero external API cost.

---

### Feature 19 — Proxy Header Detector

**Bucket: B** | **Feasibility: HIGH** | **Phase: 2** | **Extend `/api/ip`**

Analyze proxy-related headers from the incoming request:
- `Via`, `X-Forwarded-For`, `Forwarded`, `X-Real-IP`, `CF-Connecting-IP`
- Return structured result: `{ detected: boolean, headers: [...], chain: [...] }`

Combine with Feature 11 ASN heuristic for composite VPN/proxy score.

---

### Feature 20 — Reverse DNS (PTR)

**Bucket: B** | **Feasibility: HIGH** | **Phase: 1 (bundled with Feature 4)**

Extend DNS resolver to support PTR record type. For IP `1.2.3.4`, query `4.3.2.1.in-addr.arpa` via DoH. Also support IPv6 `.ip6.arpa` form.

Validate IP format before constructing reverse zone name.

---

### Feature 21 — Arbitrary IP Lookup

**Bucket: C** | **Feasibility: MEDIUM** | **Phase: 4** | **Flag: `ip_lookup` (new)**

User enters any IP address; Pages Function proxies to BGPView API:
- `GET https://api.bgpview.io/ip/<ip>` — prefix, ASN, org, country
- Display ISP, ASN, announced prefix, RPKI status

**Risks:** Rate limits on BGPView free tier. Cache results in sessionStorage. SSRF guard: validate IP format; do not accept URLs or hostnames.

Note: Cannot use `request.cf` for arbitrary IPs — external API required (Bucket C).

---

### Feature 22 — Network Calculator

**Bucket: A** | **Feasibility: HIGH** | **Phase: 2** | **Flag: `network_calculator` (new)**

Pure client-side CIDR/subnet tool:
- Input: IP address + prefix length (e.g. `192.168.1.0/24`)
- Output: network address, broadcast, first/last host, total hosts, wildcard mask
- Support IPv4; IPv6 /64-/128 optional

No backend required. InfoByIp has this as a standalone tool — fits NetPulse sidebar.

---

### Phase 4 Optional Add-ons (Bucket C)

| Feature | API | Flag |
|---|---|---|
| WHOIS / RDAP lookup | RIPE Stat / RDAP endpoints | `whois` (new, beta) |
| Weather widget | Open-Meteo (`https://api.open-meteo.com/v1/forecast`) — no API key | Geolocation panel add-on |

---

## Competitive Positioning

| Feature | fast.com | speedtest.net | ipinfo.io | browserleaks | mxtoolbox | InfoByIp | NetPulse |
|---|---|---|---|---|---|---|---|
| IP/ASN/Geo | — | Partial | Yes | Yes | — | Yes | **Shipped** |
| Geolocation map | — | — | Partial | — | — | Yes | Planned |
| Speed test (full) | Yes | Yes | — | — | — | Ping only | Planned |
| DNS lookup | — | — | — | — | Yes | Yes | Planned |
| Reverse DNS | — | — | — | — | Yes | Yes | Planned |
| Service status | — | — | — | — | — | — | Planned |
| WebRTC leak | — | — | — | Yes | — | Partial | Planned |
| HTTP headers (self) | — | — | — | Partial | Yes | Yes | Planned |
| Browser fingerprint | — | — | — | Yes | — | Yes | Planned |
| GPS vs IP compare | — | — | — | Partial | — | Yes | Planned |
| Network calculator | — | — | — | — | — | Yes | Planned |
| DNS propagation | — | — | — | — | Yes | — | Planned |
| TLS/SSL cert | — | — | — | Yes | — | Partial | Planned |
| Email (MX/SPF/DMARC) | — | — | — | — | Yes | Yes | Planned |
| BGP route | — | — | Partial | — | — | — | Planned |
| VPN/Proxy detection | — | — | Paid | — | — | Partial | Partial |
| Traceroute / MTR | — | — | — | — | — | Yes | **Skip** |
| Arbitrary IP lookup | — | — | Yes | — | — | Yes | Planned |
| Modern UX + CTAs | — | — | — | — | — | — | **Yes** |
| Edge-native (no MaxMind) | — | — | — | — | — | — | **Yes** |

---

## Architecture Corrections and Recommendations

### 1. Serve Speed Test Download as Static Assets (Not Worker Stream)
Pre-generate high-entropy `.bin` files at build time into `public/speed/`. Static requests are unlimited on Pages and use zero Worker CPU. Set `Cache-Control: no-store` on `/speed/*` in `public/_headers`; client adds `?r=<uuid>` cache-bust. Do **not** use `/api/download` Worker streaming (10 ms CPU risk on free tier).

### 2. Multi-Stream Download with User Presets
4 parallel fetches to separate chunk files (`chunk-1.bin` … `chunk-4.bin`). Three presets in `config/site.json`: Standard (20 MB), Fast (48 MB), Gigabit (100 MB). Matches fast.com / Ookla methodology.

### 3. Use `no-cors` Fetch for Service Reachability (Client-Side)
Measures user's connectivity path, not Cloudflare's. `AbortController` with 5s timeout per service.

### 4. Add DNSSEC Flag to DNS Results
Surface `AD` (Authenticated Data) flag from DoH JSON response.

### 5. Cache DNS Results
`sessionStorage` with 60-second TTL to avoid hammering DoH on repeated queries.

### 6. Tile Provider Fallback Chain
Primary: Stadia Maps `alidade_smooth_dark` (configured in `config/site.json`).  
Fallback: CARTO Dark Matter.  
Error: Show coordinates as text if map tiles fail.

### 7. Prefer Bucket B Over Bucket C for Visitor's Own Data
Always use `request.cf` for the current visitor's IP, geo, ASN, and TLS. External APIs only for user-initiated lookups of third-party IPs/domains.

### 8. Component and API Conventions
- Components: `src/components/features/<feature_id>/<Name>.tsx`
- API routes: `src/pages/api/<name>.ts`
- Types: `src/types/api.ts`
- Feature flags: `config/feature-flags.json`

---

## Build Strategy

### Phase 0 — Foundation (DONE)

- Astro SSR shell, hash router, feature flags, sidebar/header layout
- `/api/ip` with full `request.cf` extraction and IP utility helpers
- IP Discovery UI redesign with CTAs, ISP/ASN block, advanced panel
- Shared UI kit: `Card`, `Badge`, `DataRow`, `CopyButton`
- Utilities: `src/lib/ip.ts`, `src/lib/navigation.ts`, `src/lib/utils.ts`
- `/api/ping` stub, `/api/config`

---

### Phase 1 — Original Core Five (MVP Launch)

Build in dependency order:

| Order | Feature | Endpoints / Notes |
|---|---|---|
| 1 | Geolocation Map (Feature 2 + 16) | Reuse `/api/ip`; Leaflet + Stadia tiles; antipode pin |
| 2 | DNS Resolver (Feature 4 + 20) | `/api/dns` DoH proxy; PTR support; DNSSEC `AD` flag |
| 3 | Speed Test (Feature 3) | `/api/ping`, `/api/upload`, static `/speed/chunk-*.bin`; `scripts/generate-speed-chunks`; presets Standard/Fast/Gigabit |
| 4 | Service Reachability (Feature 5) | Client-side `no-cors`; services from `site.json` |
| 5 | Wire all five | Update `IMPLEMENTED` set in `src/pages/index.astro` |

**MVP exit criteria:** Sidebar items 1–5 fully functional on Cloudflare preview. No ComingSoon placeholders for core tools.

---

### Phase 2 — InfoByIp Homepage Parity (Client-First)

Extend existing panels where possible to avoid sidebar clutter:

| Work Item | Where It Lives | Bucket |
|---|---|---|
| Browser fingerprint (Feature 14) | IP page advanced panel or `browser_info` sidebar | A |
| GPS vs IP compare (Feature 15) | Geolocation panel | A+B |
| IP neighbourhood (Feature 17) | IP hero section | A |
| Incoming headers (Feature 18) | Extend `/api/ip` + IP advanced panel | B |
| Proxy header detect (Feature 19) | Extend `/api/ip` + Feature 11 | B |
| Network calculator (Feature 22) | New sidebar feature | A |
| Feature 10 standalone panel | Optional; partially in Feature 1 | A+B |

---

### Phase 3 — Privacy and Developer Tools

| Feature | Flag ID | Bucket | Notes |
|---|---|---|---|
| WebRTC Leak (Feature 6) | `webrtc_leak` | A | 100% client-side |
| HTTP Headers analyzer (Feature 7) | `http_headers` | B | `/api/headers` with SSRF guard |
| VPN/Proxy badge (Feature 11) | extend `ip_discovery` | A+B | Heuristic + proxy headers only (no ip-api.com) |
| Email MX/SPF/DMARC (Feature 12) | `email_deliverability` | B | Reuse DNS infra |

---

### Phase 4 — Free API Lookup Tools

| Feature | Flag ID | API | Bucket |
|---|---|---|---|
| DNS Propagation (Feature 8) | `dns_propagation` | Multi-DoH fan-out | C |
| SSL/TLS Inspector (Feature 9) | `ssl_cert` | crt.sh proxy | C |
| BGP Route (Feature 13) | `bgp_route` | BGPView / RIPE Stat | C |
| Arbitrary IP Lookup (Feature 21) | `ip_lookup` | BGPView | C |
| WHOIS / RDAP | `whois` | RIPE Stat / RDAP | C |
| Weather widget | geolocation add-on | Open-Meteo | C |

**Prerequisite:** Privacy policy page before enabling Bucket C features at public scale.

---

### Phase 5 — Polish and Growth

- Dual-stack probe (optional client fetch to IPv4/IPv6 check endpoints)
- `sessionStorage` DNS cache (60s TTL) across all DNS features
- Per-feature loading skeletons and error boundaries (match IP page pattern)
- Feature flag entries for new tools: `browser_info`, `ip_lookup`, `network_calculator`, `whois`
- API route stubs for Phase 4 endpoints

---

## Feature Classification Matrix

| # | Feature | Bucket | Phase | Status |
|---|---|---|---|---|
| 1 | IP & ASN Discovery | B+A | 0 | **Complete** |
| 2 | Geolocation Map | B+A | 1 | Planned |
| 3 | Speed Test | B+A | 1 | Planned |
| 4 | DNS Resolver | B | 1 | Planned |
| 5 | Service Reachability | A | 1 | Planned |
| 6 | WebRTC Leak Detector | A | 3 | Planned |
| 7 | HTTP Security Headers | B | 3 | Planned |
| 8 | DNS Propagation | C | 4 | Planned |
| 9 | TLS/SSL Inspector | C+B | 4 | Planned |
| 10 | Connection Inspector | A+B | 2 | Partial (in Feature 1 advanced panel) |
| 11 | VPN/Proxy Detection | A+B | 3 | **Partial (in Feature 1)** |
| 12 | Email Deliverability | B | 3 | Planned |
| 13 | BGP Route Lookup | C | 4 | Planned |
| 14 | Browser Fingerprint | A | 2 | **Partial (in Feature 1)** |
| 15 | GPS vs IP Compare | A+B | 2 | Planned |
| 16 | Antipode Map Pin | A | 1 | Planned |
| 17 | IP Neighbourhood | A | 2 | **Complete (in Feature 1)** |
| 18 | Incoming Request Headers | B | 2 | **Complete (in Feature 1)** |
| 19 | Proxy Header Detector | B | 2 | **Complete (in Feature 1)** |
| 20 | Reverse DNS (PTR) | B | 1 | Planned |
| 21 | Arbitrary IP Lookup | C | 4 | Planned |
| 22 | Network Calculator | A | 2 | Planned |
| — | WHOIS / RDAP | C | 4 | Planned |
| — | Weather Widget | C | 4 | Planned |
| — | Traceroute / MTR | — | — | **Skip** |
| — | TCP/FTP/SSH Port Scan | — | — | **Skip** |
| — | IP Bulk Lookup | — | — | **Skip** |
| — | Dev Minifiers / Encoders | — | — | **Skip** |

---

## MVP vs Full Roadmap

| Scope | Features | Target |
|---|---|---|
| **MVP (Phase 1)** | 1–5 (+16 antipode, +20 PTR) | Public launch; all core sidebar tools live |
| **Parity (Phase 2)** | 10, 14–19, 22 | InfoByIp homepage parity + network calculator |
| **Privacy/Dev (Phase 3)** | 6, 7, 11, 12 | VPN users and developers |
| **Lookup Tools (Phase 4)** | 8, 9, 13, 21, WHOIS, weather | Power users; requires privacy policy |
| **Polish (Phase 5)** | Dual-stack probe, caching, error UX | Retention and reliability |

---

## Cloudflare Pages Functions Platform Limits

All limits below assume **Workers Free ($0)**. NetPulse is designed to stay within these bounds without upgrading.

| Limit | Free Tier | Paid Tier | NetPulse stance |
|---|---|---|---|
| CPU time per request | 10ms | 30ms+ (extendable) | Applies to ping/upload only; download is static |
| Requests per day | 100,000 | 10M+/mo included | ~9 Worker calls per test (download excluded) |
| Wall-clock per request | 30 seconds | 30 seconds | Sufficient for upload test |
| Memory per invocation | 128MB | 128MB | Stream-read upload body |
| Outbound subrequests per invocation | 50 | 10,000 | DNS propagation fits in 50 |
| Request body max size | 100MB | 100MB | 5MB upload default |
| WebSockets (stateful) | Requires Durable Objects (Paid) | Yes | **Not used** |
| SSE / chunked streaming | Yes | Yes | Used for upload stream discard |
| `request.cf` geo fields in local dev | Not populated | N/A | Dev banner in UI |

---

## Dependencies Required

| Dependency | Use | License | CDN-loadable |
|---|---|---|---|
| Leaflet.js (~42KB) | Map rendering | BSD 2-Clause | Yes |
| Stadia Maps / CartoDB tiles | Dark map tiles | CC BY / Free tier | Via tile URL |
| canvas-gauges (~60KB) OR custom canvas | Speed test gauge | MIT | Yes |
| Tailwind CSS 3 | Styling | MIT | Build-time |
| React 19 + Astro 6 | UI components | MIT | Build-time |
| No database or auth required | | | |

All Bucket A features use native Web APIs (fetch, ReadableStream, RTCPeerConnection, Performance API, Geolocation API). All Bucket B features use Cloudflare's edge network via Pages Functions. Bucket C features proxy to free public APIs with no API keys required (except optional Stadia Maps key for higher limits).

---

## Resolved Open Questions

1. **CARTO vs Stadia Maps** — **Resolved:** Stadia Maps primary, configured in `config/site.json` `maps.tileProvider: "stadia"`.
2. **Speed test download** — **Resolved:** Static pre-generated `.bin` files in `public/speed/` (build-time). Three presets: Standard 20 MB, Fast 48 MB, Gigabit 100 MB (4×25 MiB chunks). No `/api/download` Worker endpoint.
3. **Stack choice** — **Resolved:** Astro 6 SSR + React 19 + TypeScript (not vanilla JS as originally specified).
4. **Dual-stack badge semantics** — **Resolved:** Show connection protocol (IPv4/IPv6), not false dual-stack indicator. Optional probe deferred to Phase 5.
5. **InfoByIp scope** — **Resolved:** Adopt network/browser tools only; skip dev minifiers, traceroute, port scanning.
6. **Paid Workers tier** — **Resolved:** Not required. Download via static assets eliminates Worker CPU for Phase B. Upload/ping only use Worker.
7. **VPN detection** — **Resolved:** Heuristic-only (no ip-api.com) per free-tier policy.
8. **Static vs Worker download** — **Resolved:** Static assets chosen over Worker PRNG stream for free-tier CPU safety.

---

## Remaining Open Questions

1. **Privacy policy timing** — Required before Phase 4 (Bucket C features) at public scale. Draft before enabling BGPView, crt.sh, Open-Meteo proxies.
2. **Feature sidebar size** — Phase 2 adds `browser_info` and `network_calculator` flags. Consider grouping advanced tools under a "More tools" section if sidebar exceeds 8 items.
3. **IPv6 neighbourhood** — Feature 17 is IPv4-only. Show disabled state for IPv6 users or implement /64 neighbour display?
4. **100k/day Worker quota at scale** — Download is static (unlimited). Only ping + upload consume Worker quota (~9/test). Add cooldown if ping/upload volume grows.
5. **Gigabit preset deploy time** — ~100 MB of generated binaries increases build/deploy duration. Acceptable; files stay gitignored.
