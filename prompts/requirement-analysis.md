# Requirement Analysis: All-in-One Network Intelligence Hub

**Date:** 2026-06-18  
**Platform Target:** Cloudflare Pages + Pages Functions  
**Stack:** Single-page app, Tailwind CSS, Leaflet.js, vanilla JS, no external backend dependencies

---

## Executive Summary

The proposed Network Intelligence Hub is architecturally sound and buildable on Cloudflare Pages with the specified constraints. Five of the core features are feasible as-specified; several carry medium-to-high technical risks that require mitigation. Two features (service reachability, speed test) have design flaws in the prompt that need correction. Privacy and legal obligations are manageable without significant friction. The platform has excellent new additions that could strongly differentiate this tool from competitors.

---

## Feature-by-Feature Feasibility Analysis

### Feature 1 — Advanced IP & ASN Discovery Module

**Feasibility: HIGH**

| Aspect | Status |
|---|---|
| `CF-Connecting-IP` header | Available in all Pages Functions environments |
| `request.cf.asn` | Available in production and preview |
| `request.cf.asOrganization` | Available in production and preview |
| Local dev (`wrangler pages dev`) | `request.cf` is mostly empty — stubs only |

**Technical Notes:**
- `latitude` and `longitude` are strings (not numbers) — `"37.7749"` not `37.7749`. Parser required before passing to Leaflet.
- `city`, `region`, `postalCode` can be `undefined` for VPN/proxy IPs, datacenter IPs, and some regional ISPs with incomplete MaxMind coverage.
- The "IPv4/IPv6 Dual Stack" badge requires returning which protocol was used for the connection. `CF-Connecting-IP` is always the client IP regardless of protocol. To detect IPv6 specifically, check if the IP contains `:` (colons). True dual-stack detection requires separate IPv4/IPv6 endpoints.

**Risks:**
- Low — this is the simplest feature in the set.
- `asOrganization` may return raw RIR text like `"GOOGLE"` or `"AS-CHOOPA"` — format it defensively.

---

### Feature 2 — High-Precision Geolocation Map Module

**Feasibility: HIGH (with caveats)**

**Technical Notes:**
- Leaflet.js with CartoDB Dark Matter tiles is valid. Attribution required: `© OpenStreetMap contributors © CARTO`.
- CartoDB tile URL: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- CARTO's ToS (as of 2023 update) restricts commercial use without an account. For a public tool with moderate traffic, free tier applies but has an unpublished tile request cap (~50k–100k/month).
- **Alternative with better free tier:** Stadia Maps (`alidade_smooth_dark` style) — 200k tile requests/month free, no API key needed.

**Risks:**
- CARTO tile availability under heavy traffic: Medium. Mitigate with Stadia Maps as fallback.
- Geo accuracy: IP geolocation is city-level at best, often off by 50–200km. Consider adding a disclaimer ("Approximate location based on IP").
- `latitude`/`longitude` undefined for some users (VPN, Tor, certain proxies): Requires fallback UI state (show "Location unavailable" rather than crashing).

---

### Feature 3 — Real-Time Network Speed Test Engine

**Feasibility: MEDIUM — significant design corrections needed**

#### Phase A: Ping & Jitter
- 6 successive `HEAD` requests to `/api/ping` is correct methodology.
- Jitter as mean absolute deviation of sequential RTTs is standard.
- **Risk:** First ping is always higher (DNS, TCP connect, TLS handshake). Discard first sample or run a warmup request. Recommend 8 pings, discard first 2.

#### Phase B: Download
- 5MB binary asset served as a static Pages file will be **CDN-cached at the edge**. This is a known design issue.
- The test will measure Cloudflare edge proximity, not the user's ISP bandwidth to origin.
- This is actually acceptable for a speed tool — fast.com, speedtest.net, and Cloudflare's own speed test all serve files from CDN. The CDN edge IS the endpoint. Just set user expectations.
- **Critical flaw:** 5MB saturates ~40 Mbps connections. For users on 100–1000 Mbps connections, the test completes in <0.4s — insufficient for accurate measurement. Implement parallel streams (2–4 simultaneous fetches) or use 25–50MB.
- Must set `Cache-Control: no-cache, no-store` and use a randomized `?r=<uuid>` param to prevent browser cache reuse between test runs.

#### Phase C: Upload
- `Uint8Array` random data generation in browser is correct (prevents compression spoofing).
- POST to Pages Function works — free tier handles 100MB max body, 30-second wall-clock limit.
- **CPU limit:** Free tier is 10ms CPU time. Processing a 5MB upload stream (reading chunks and discarding) is minimal CPU. Feasible.
- **Critical:** The Worker must **stream-read and discard** the upload body — never buffer it fully in memory (128MB Worker memory limit). Use `request.body.getReader()` loop.
- **Real measurement issue:** Upload test measures throughput from user → Cloudflare edge, not user → origin. This is intentional and acceptable.

**Gauge UI:**
- Canvas-based gauges work well. Recommended libraries: `canvas-gauges` (MIT license, ~60KB, dark themes built-in) or a custom `requestAnimationFrame` canvas implementation.
- Avoid Chart.js for gauges — it doesn't have a true speedometer; workarounds are brittle.

---

### Feature 4 — Edge-Accelerated DNS Resolver Tool

**Feasibility: HIGH**

- Cloudflare Pages Functions can make outbound `fetch()` to `https://1.1.1.1/dns-query` with `Accept: application/dns-json`. No CORS issues (server-to-server fetch, CORS is a browser-only constraint).
- Google's DoH at `https://dns.google/resolve?name=&type=` is a valid alternative.
- Input sanitization: Validate domain names against RFC 1123 regex before forwarding to prevent SSRF/injection. Do not pass arbitrary URLs or IPs directly to the DoH endpoint as the `name` parameter.

**Supported record types (A, AAAA, MX, TXT, CNAME):** All supported by `1.1.1.1/dns-query`.

**Additional record types worth supporting:** NS, SOA, PTR (reverse DNS) — low effort, high value for power users.

**Risks:**
- Cloudflare 1.1.1.1 DoH does not publish strict rate limits but unusual automated query patterns may trigger throttling.
- Cache DNS responses in the browser (sessionStorage) to avoid redundant queries on re-searches.
- DNSSEC validation status can be returned from the DoH response (`AD` flag in the JSON) — worth surfacing.

---

### Feature 5 — Live Services Reachability Status Matrix

**Feasibility: MEDIUM — fundamental architectural problem**

**The core issue:** The prompt specifies "concurrent, non-blocking asynchronous requests to public edge destinations" — this implies browser-side `fetch()` calls. This is broken by CORS.

Direct `fetch('https://google.com')` from a browser returns a CORS error (opaque response). You can use `mode: 'no-cors'` to detect TCP reachability (no network error = reachable) but you cannot read status codes or measure latency accurately.

**Two valid approaches:**

| Approach | Pros | Cons |
|---|---|---|
| **Client-side `no-cors` fetch** | Measures user's actual network path | Cannot read status codes; latency is rough estimate |
| **Server-side proxy via Pages Function** | Clean status codes and precise latency | Measures Cloudflare-to-service path, NOT user's path |

**Recommendation:** Use client-side `no-cors` mode for user-path accuracy (which is the actual intent — "can this user reach these services?"). Supplement with `performance.now()` timing around the fetch for latency estimation.

**Risks:**
- No-cors mode returns opaque responses — green/red only, no HTTP status.
- Timeout handling requires `AbortController` with ~5s timeout per service.
- Some services (e.g., GitHub API) may add rate limiting for frequent anonymous requests.

---

## Privacy & Legal Analysis

### GDPR (EU)

| Action | Classification | Risk | Mitigation |
|---|---|---|---|
| Displaying user's own IP | Legitimate interest / service delivery | Low | No action needed |
| Logging IP server-side | Personal data processing | Medium-High | Do not log IPs; use Cloudflare analytics only |
| Forwarding user IP to DoH (1.1.1.1) | Data transfer to third party | Low | Cloudflare already processes the request; disclose in privacy policy |
| Forwarding user IP to external geo APIs | Data transfer to third party | Medium | Avoid — use `request.cf` object instead (no external call needed) |

**Key principle:** `request.cf` gives you everything you need for geo/ASN data — you never need to send the user's IP to an external API like ip-api.com. This eliminates the main GDPR data-transfer concern.

### EU ePrivacy Directive
- Does not apply to IP display tools.
- Applies if you add analytics cookies or tracking pixels. If using analytics (e.g., Cloudflare Web Analytics), ensure it is cookie-free (Cloudflare's own analytics product is GDPR-exempt).

### CCPA (California)
- IP + geolocation = personal information under CCPA.
- Obligation only applies to "businesses" (&gt;$25M revenue OR processes data of &gt;100k consumers).
- A small tool: low obligation. A public-facing tool at scale: add a privacy policy disclosing that no data is stored.

### Third-Party Service ToS (Feature 5)
- HTTP `HEAD` requests to check reachability: Generally tolerated by Google, AWS, GitHub, Cloudflare, YouTube. This is equivalent to what uptime monitoring services do.
- Do **not** fetch and render content from third-party pages — only check status code and response time.
- Use a descriptive `User-Agent` header like `Network-Intelligence-Hub/1.0 (reachability-check)`.

### DNS-over-HTTPS Legal Notes
- No legal restrictions on using Cloudflare's 1.1.1.1 DoH or Google's 8.8.8.8 DoH for application queries.
- Some jurisdictions (Turkey, Russia, China) block DoH endpoints — purely a connectivity issue, not a legal issue for the tool operator.

### WHOIS Data
- GDPR has significantly reduced personal data in WHOIS since 2018 (domain registrant details are redacted). WHOIS lookups return mostly technical data (registrar, nameservers, dates) which has no privacy concern.

---

## Technical Risks Summary

| Risk | Severity | Feature | Recommendation |
|---|---|---|---|
| `request.cf` fields undefined locally | Medium | 1, 2 | Always test geo on deployed preview, not `wrangler dev` |
| `lat`/`lon` undefined for VPN/proxy users | High | 2 | Null checks; graceful fallback UI |
| Speed test 5MB too small for fast connections | High | 3B | Use parallel streams or 25MB+ file |
| Browser CORS blocks service reachability fetch | High | 5 | Use `no-cors` mode with `AbortController` |
| CARTO tiles under heavy load | Medium | 2 | Switch to Stadia Maps dark style |
| Upload endpoint: Worker memory overflow | Medium | 3C | Stream-read body, never buffer |
| DNS injection via unsanitized input | High | 4 | Validate domain regex before forwarding |
| Cold start on Upload endpoint | Low | 3C | Cloudflare Workers have near-zero cold start (~0ms) |
| SSL cert inspection not possible natively | Medium | (Enhancement) | Use crt.sh CT Log API proxy |
| WebSocket stateful connections need Durable Objects | Medium | (Enhancement) | Use SSE for one-way streaming features |

---

## Proposed New Features (Differentiation Opportunities)

Based on competitive analysis of fast.com, speedtest.net, ipinfo.io, browserleaks.com, mxtoolbox.com, and emerging tools, the following additions would significantly attract power users:

---

### Feature 6 — WebRTC IP Leak Detector *(High Value, Zero Backend Cost)*

**What it does:** Reveals all IPs exposed via WebRTC ICE candidates — shows if VPN is leaking real IP, exposes LAN IP, detects IPv6 leak even when VPN only tunnels IPv4.

**Implementation:** 100% client-side JavaScript. No Pages Function needed.

```js
const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
pc.createDataChannel('');
pc.onicecandidate = (e) => { /* parse e.candidate.candidate for IPs */ };
pc.createOffer().then(o => pc.setLocalDescription(o));
```

**Why users love it:** Essential for VPN users wanting to verify their VPN doesn't leak. Browserleaks.com is hugely popular for this exact feature. Zero server cost, instant results.

**Caveat (2024 browsers):** Chrome anonymizes LAN IPs with mDNS UUIDs (`abc.local`). Public IP still leaks via `srflx` candidates. Surface both.

---

### Feature 7 — HTTP Security Headers Analyzer *(High Value, Simple Backend)*

**What it does:** User enters any URL; tool fetches the site's response headers from your Pages Function and grades them: HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.

**Implementation:** Pages Function does a `HEAD` request to the target URL and returns the security-relevant headers. Client displays a grade (A+/A/B/C/F) similar to securityheaders.com.

**Why users love it:** Developers constantly need to audit their own sites. This turns your tool into a developer utility, not just an end-user tool — broadens the audience.

**Pages Function pattern:**
```js
const res = await fetch(targetUrl, { method: 'HEAD' });
// Return res.headers as JSON
```

**Risk:** SSRF — validate that the target URL is a public HTTPS hostname, not an internal IP range.

---

### Feature 8 — DNS Propagation Checker *(High Value, Moderate Backend)*

**What it does:** Given a domain, queries multiple global DNS resolvers (Cloudflare 1.1.1.1, Google 8.8.8.8, Quad9, OpenDNS, regional resolvers) and shows which have the latest record and which are still serving stale data.

**Why users love it:** Every developer migrating DNS needs this. dnschecker.org's most-used feature is exactly this. A map visualization showing global propagation status is very attractive.

**Implementation:** Pages Function fans out `fetch()` calls to multiple DoH endpoints in parallel. All are free, public, no API keys.

**Resolvers to check:**
- Cloudflare: `https://1.1.1.1/dns-query`
- Google: `https://8.8.8.8/dns-query`
- Quad9: `https://9.9.9.9/dns-query`
- AdGuard: `https://dns.adguard.com/dns-query`
- OpenDNS: `https://doh.opendns.com/dns-query`

---

### Feature 9 — TLS/SSL Certificate Inspector *(Medium Value, Requires External API)*

**What it does:** Shows certificate details for any domain — expiry date, issuer, SANs, chain, HSTS status, TLS version supported.

**Implementation options:**
1. Proxy to **crt.sh** Certificate Transparency logs (`https://crt.sh/?q=<domain>&output=json`) — free, no API key, returns all issued certs for a domain. Limitation: shows historical certs, not live connection cert.
2. Proxy to **SSL Labs API** (`https://api.ssllabs.com/api/v3/`) — live scan, full grade, but slow (takes 60–120 seconds) and has strict rate limits.
3. Show cert data from `request.cf.tlsVersion` and `request.cf.tlsCipher` for the **incoming connection** only — instant, zero cost, but only shows the user's own connection to your site.

**Recommendation:** Implement option 1 (crt.sh proxy) for instant results + option 3 for the user's own connection. Skip SSL Labs due to latency/rate limits.

---

### Feature 10 — Network Protocol & Connection Inspector *(Zero Backend, High UX Value)*

**What it does:** Displays technical details about the current browser's connection and capabilities from multiple sources:

| Data Point | Source |
|---|---|
| HTTP version used (HTTP/1.1 / HTTP/2 / HTTP/3) | `request.cf.httpProtocol` from `/api/ip` |
| TLS version + cipher suite | `request.cf.tlsVersion`, `request.cf.tlsCipher` |
| Estimated bandwidth | `navigator.connection.downlink` |
| Network type (WiFi/Cellular/Ethernet) | `navigator.connection.type` |
| Round-trip time estimate | `navigator.connection.rtt` |
| Data saver mode active | `navigator.connection.saveData` |
| Browser's own geolocation (if permitted) | `navigator.geolocation.getCurrentPosition()` |

**Why users love it:** Power users and developers want to know exactly what protocol/cipher is negotiated. Compare IP-based geo vs browser GPS geo — the delta shows VPN usage. The Network Information API is hidden from most users.

---

### Feature 11 — VPN / Proxy / Tor Detection Badge *(Medium Value)*

**What it does:** Analyzes the request from multiple signals and tells the user whether their connection appears to be a VPN, proxy, hosting datacenter, or Tor exit node.

**Data sources (all from `request.cf`):**
- ASN organization: Is it a known hosting/VPN provider (DigitalOcean, Vultr, NordVPN ASNs)?
- `request.cf.isEUCountry` cross-checked with claimed country
- `botManagement.score` (Enterprise only — skip for now)

**Free external enhancement:** `ip-api.com/json/{ip}?fields=proxy,hosting,vpn` — free API returning proxy/hosting/VPN flags (1k requests/min free). Requires sending user IP to third party; disclose in privacy policy.

---

### Feature 12 — Email Deliverability Checker (MX / SPF / DKIM / DMARC) *(Very High Value)*

**What it does:** User enters a domain; tool queries DNS for MX, SPF (TXT), DMARC (TXT at `_dmarc.<domain>`), and shows whether email is configured correctly.

**Why users love it:** Email deliverability is a constant pain point for developers, marketers, and sysadmins. This is mxtoolbox.com's killer feature. Can be built entirely with your existing DNS resolver infrastructure (Feature 4).

**Pages Function work:** Parallel DoH queries for:
- `MX <domain>` — mail server lookup
- `TXT <domain>` — SPF record (`v=spf1 ...`)
- `TXT _dmarc.<domain>` — DMARC policy
- `TXT default._domainkey.<domain>` — DKIM (selector varies; show known selectors)

---

### Feature 13 — BGP / Route Lookup *(Niche but High Prestige)*

**What it does:** For any IP or ASN, shows the BGP route: announced prefix, origin AS, upstreams, geolocation of ASN, RPKI validation status.

**Implementation:** Proxy to RIPE Stat REST API (free, no key) or BGPView API (free, no key):
- `https://api.bgpview.io/ip/<ip>` — IP to prefix + ASN
- `https://stat.ripe.net/data/routing-status/data.json?resource=<ip>`

**Why users want it:** Network engineers, security researchers, ISP customers investigating routing anomalies. Niche but adds significant credibility/authority to the tool.

---

## Competitive Positioning

| Feature | fast.com | speedtest.net | ipinfo.io | browserleaks | mxtoolbox | This Tool |
|---|---|---|---|---|---|---|
| IP/ASN/Geo | — | Partial | Yes | Yes | — | Yes |
| Speed Test | Yes | Yes | — | — | — | Yes |
| DNS Lookup | — | — | — | — | Yes | Yes |
| Service Status | — | — | — | — | — | Yes |
| WebRTC Leak | — | — | — | Yes | — | **+Proposed** |
| HTTP Headers | — | — | — | Partial | Yes | **+Proposed** |
| DNS Propagation | — | — | — | — | Yes | **+Proposed** |
| TLS/SSL Cert | — | — | — | Yes | — | **+Proposed** |
| HTTP/TLS Protocol Info | — | — | — | Yes | — | **+Proposed** |
| Email (MX/SPF/DMARC) | — | — | — | — | Yes | **+Proposed** |
| BGP Route | — | — | Partial | — | — | **+Proposed** |
| VPN/Proxy Detection | — | — | Paid | — | — | **+Proposed** |

A tool combining all of the above with a clean modern UI on Cloudflare's edge would be the best all-in-one network diagnostic tool currently available publicly.

---

## Architecture Corrections and Recommendations

### 1. Serve Speed Test Binary from Pages Function, Not Static Asset
Static assets get aggressive CDN caching. Instead, create a Pages Function route `/api/download` that streams random bytes with `Cache-Control: no-store`. This ensures bytes travel from edge to user each time.

### 2. Multi-Stream Download for Accuracy
To saturate connections above 40 Mbps, run 4 parallel fetch streams simultaneously and sum the throughput. This is how fast.com and Ookla work.

### 3. Use `no-cors` Fetch for Service Reachability (Client-Side)
Replace server-side service checks with client-side `no-cors` fetches with `AbortController` timeouts. This accurately reflects the user's connectivity, not Cloudflare's.

### 4. Add DNSSEC Flag to DNS Results
The DoH JSON response from 1.1.1.1 includes an `AD` (Authenticated Data) flag — return this alongside DNS records to show DNSSEC validation status.

### 5. Cache DNS Results
Store DNS query results in `sessionStorage` with a 60-second TTL to avoid hammering the DoH endpoint on every keystroke.

### 6. Tile Provider Fallback Chain
Primary: Stadia Maps `alidade_smooth_dark` (200k/month free, better ToS than CARTO).  
Fallback: CARTO Dark Matter (with attribution).  
Error: Show coordinates as text if map fails.

---

## Implementation Priority Recommendations

### Phase 1 (Core — as specified)
1. IP/ASN Discovery (`/api/ip`)
2. Geolocation Map (`/api/ip` reused)
3. Speed Test Engine (`/api/ping`, `/api/upload`, static download asset)
4. DNS Resolver (`/api/dns`)
5. Service Reachability (client-side, `no-cors`)

### Phase 2 (High ROI additions)
6. WebRTC Leak Detector (client-side, zero cost)
7. HTTP Protocol Inspector (reuse `/api/ip` response, add `httpProtocol`/`tlsVersion`)
8. Email Deliverability Checker (reuse DNS infrastructure)
9. DNS Propagation Checker (new `/api/dns-propagation` endpoint)

### Phase 3 (Power User Features)
10. HTTP Security Headers Analyzer (`/api/headers?url=`)
11. TLS/SSL Certificate Inspector (proxy to crt.sh)
12. VPN/Proxy Detection Badge (extend `/api/ip`)
13. BGP Route Lookup (proxy to RIPE Stat or BGPView)

---

## Cloudflare Pages Functions Platform Limits

| Limit | Free Tier | Paid Tier |
|---|---|---|
| CPU time per request | 10ms | 30ms (extendable) |
| Wall-clock per request | 30 seconds | 30 seconds |
| Memory per invocation | 128MB | 128MB |
| Outbound subrequests per invocation | 50 | Higher |
| Request body max size | 100MB | 100MB |
| WebSockets (stateful) | Requires Durable Objects (Paid) | Yes |
| SSE / chunked streaming | Yes | Yes |
| `request.cf` geo fields in local dev | Not populated | N/A |

---

## Dependencies Required

| Dependency | Use | License | CDN-loadable |
|---|---|---|---|
| Leaflet.js (~42KB) | Map rendering | BSD 2-Clause | Yes |
| Stadia Maps / CartoDB tiles | Dark map tiles | CC BY / Free tier | Via tile URL |
| canvas-gauges (~60KB) OR custom canvas | Speed test gauge | MIT | Yes |
| Tailwind CSS (via CDN play) | Styling | MIT | Yes |
| No others required | | | |

All other features use native Web APIs (fetch, ReadableStream, RTCPeerConnection, Performance API) and Cloudflare's edge network. No Node.js, no Express, no databases, no authentication services required.

---

## Open Questions / Decisions Needed

1. **CARTO vs Stadia Maps for tiles** — Stadia is recommended (better free tier, clearer ToS). Decision needed before implementation.
2. **Speed test file size** — 5MB (as specified) or 25MB for accuracy on fast connections? Larger file increases egress cost (minimal at Cloudflare's rates but worth noting).
3. **Privacy policy requirement** — If the tool is public-facing and uses ip-api.com for VPN detection (Feature 11), a privacy policy disclosing that third-party API call is required for GDPR compliance.
4. **Phase 2/3 scope** — Confirm which of the proposed new features to include in the initial build vs. a later iteration.
5. **Paid vs Free tier** — Some enhancements (WebSocket-based real-time updates, long-running uploads) benefit from Workers Paid tier. Confirm if billing is enabled on the target Cloudflare account.
