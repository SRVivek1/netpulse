# NetPulse

All-in-one network intelligence hub — IP & ASN discovery, DNS lookup, speed testing, and more. Built on **Astro 6 SSR + React 19 + TypeScript + Tailwind CSS**, deployed to **Cloudflare Pages** with no traditional backend or database.

## Implementation Status

| MVP Sidebar Tool | Feature ID | Status |
|------------------|------------|--------|
| IP & Location | `ip_discovery` | **Shipped** (includes geo map, GPS vs IP, antipode) |
| DNS Lookup | `dns_resolver` | **Shipped** (includes PTR, DNSSEC, RDAP) |
| Speed Test | `speed_test` | **Shipped** (ping, download, upload) |
| Service Status | `service_status` | Planned |

**Next up:** Service Reachability (Feature 5) — the final MVP sidebar tool.

## Commands

| Command | Action |
|---------|--------|
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `localhost:4321` (generates speed chunks on first run) |
| `npm run build` | Production build to `./dist/` |
| `npm run preview` | Preview production build locally |
| `npm run generate-speed-chunks` | Regenerate `public/speed/*.bin` test files |

## Documentation

- [Developer Guide](docs/developer-guide.md) — local setup and contributing
- [Architecture Guide](docs/architecture.md) — system design and data flows
- [Requirement Analysis](prompts/requirement-analysis.md) — full feature roadmap
- [Cloudflare Deployment](docs/cloudflare-pages-deployment.md) — deploy to Pages
