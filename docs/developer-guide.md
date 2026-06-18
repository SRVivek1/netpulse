# Developer Guide

A step-by-step guide to setting up, running, and contributing to NetPulse locally.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 18.17.1 | Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions |
| npm | >= 9 | Comes with Node.js |
| Git | Any modern | For cloning the repo |

Verify your environment:

```bash
node --version   # should print v18.17.1 or higher
npm --version    # should print 9.x or higher
```

---

## 1. Clone & Install

```bash
# Clone the repo
git clone <repository-url> netpulse
cd netpulse

# Install dependencies
npm install
```

---

## 2. Start the Dev Server

```bash
npm run dev
```

The app starts at **http://localhost:4321** with hot-module replacement. The terminal output will confirm the port:

```
 astro  v5.x.x ready in xxx ms

  ┌─────────────────────────────────────────────┐
  │ Local    http://localhost:4321/             │
  └─────────────────────────────────────────────┘
```

Open the URL in your browser. You should see the NetPulse dashboard with the IP Discovery panel active by default.

> **Note:** The IP Discovery feature calls `/api/ip`, which reads from Cloudflare's `request.cf` object. In local dev, the Astro Cloudflare adapter's `platformProxy` emulates this — you may see partial/mock geo data instead of real edge data. This is expected behavior.

---

## 3. Project Commands

```bash
# Start development server with live reload
npm run dev

# Build production bundle to ./dist/
npm run build

# Preview the production build locally (requires npm run build first)
npm run preview

# Regenerate Cloudflare Worker TypeScript types
npm run generate-types
```

---

## 4. Project Structure

```
netpulse/
├── config/
│   ├── site.json            # Site metadata, ads, analytics, maps, DNS config
│   └── feature-flags.json   # Feature toggle, display order, labels, icons
├── public/
│   ├── favicon.svg
│   └── _headers             # Cloudflare edge caching rules
├── src/
│   ├── pages/
│   │   ├── index.astro      # Main entry point — renders the full dashboard
│   │   └── api/
│   │       ├── ip.ts        # GET /api/ip — returns IP + geo from CF edge
│   │       ├── ping.ts      # GET|HEAD /api/ping — latency probe endpoint
│   │       └── config.ts    # GET /api/config — public-safe config dump
│   ├── layouts/
│   │   └── Shell.astro      # Root HTML shell: sidebar, header, font loading
│   ├── components/
│   │   ├── Header.astro     # Top bar: title, status pill, ad slot
│   │   ├── Sidebar.astro    # Left navigation (desktop); bottom nav (mobile)
│   │   ├── features/
│   │   │   ├── ip/
│   │   │   │   └── IpDiscovery.tsx   # IP discovery React feature panel
│   │   │   └── ComingSoon.tsx        # Placeholder for unbuilt features
│   │   └── ui/
│   │       ├── Card.tsx       # Card, CardHeader, CardBody
│   │       ├── DataRow.tsx    # Labeled key-value row
│   │       ├── Badge.tsx      # Color-coded status badge
│   │       └── CopyButton.tsx # Copy-to-clipboard with visual feedback
│   ├── lib/
│   │   ├── config.ts        # Config loader — splits public vs private fields
│   │   ├── router.ts        # Vanilla JS hash-based panel router
│   │   └── utils.ts         # cn(), copyToClipboard(), formatCoords()
│   ├── types/
│   │   ├── api.ts           # IpData interface
│   │   └── config.ts        # SiteConfig, FeatureFlags, AppConfig types
│   └── styles/
│       └── global.css       # Global Tailwind directives + custom animations
├── astro.config.mjs         # Astro: SSR mode, React + Tailwind integrations, CF adapter
├── tailwind.config.cjs      # Custom fonts, dark mode, surface color tokens
├── tsconfig.json            # Strict TypeScript config
├── wrangler.jsonc           # Cloudflare Workers deployment config
└── package.json
```

---

## 5. Configuration

### `config/site.json`

Controls site-level settings: name, description, URL, analytics IDs, ad slots, maps API keys. Edit this file to change branding or toggle third-party integrations.

### `config/feature-flags.json`

Controls which features appear in the sidebar and in what order. Toggle `enabled: true/false` to show or hide a feature without touching code. Each entry has:

```json
{
  "id": "ip_discovery",
  "label": "IP Discovery",
  "icon": "globe",
  "enabled": true,
  "order": 1
}
```

---

## 6. Adding a New Feature

1. **Add the feature flag** in `config/feature-flags.json`:
   ```json
   {
     "id": "my_feature",
     "label": "My Feature",
     "icon": "activity",
     "enabled": true,
     "order": 99
   }
   ```

2. **Create the React component** at `src/components/features/my_feature/MyFeature.tsx`:
   ```tsx
   export default function MyFeature() {
     return <div>My Feature content</div>
   }
   ```

3. **Register it** in `src/pages/index.astro` — add it to the feature-to-component mapping alongside `IpDiscovery`.

4. **Add an API route** (if needed) at `src/pages/api/my-feature.ts`:
   ```ts
   import type { APIRoute } from 'astro'

   export const GET: APIRoute = async ({ request }) => {
     return new Response(JSON.stringify({ ok: true }), {
       headers: { 'Content-Type': 'application/json' }
     })
   }
   ```

---

## 7. Styling Conventions

- Use **Tailwind utility classes** directly in JSX/Astro templates.
- Use the `cn()` helper from `src/lib/utils.ts` to conditionally merge classes:
  ```tsx
  import { cn } from '@/lib/utils'
  <div className={cn('base-class', condition && 'conditional-class')} />
  ```
- **Color tokens** (defined in `tailwind.config.cjs`):
  - `bg-surface` — main panel background
  - `bg-elevated` — slightly lighter panels
  - `bg-hover` / `bg-active` — interactive states
- **Fonts:**
  - Body text: `font-sans` → DM Sans
  - Display/headings: `font-display` → Syne
  - Code/monospace: `font-mono` → JetBrains Mono

---

## 8. TypeScript

The project uses strict TypeScript (`strict: true` in `tsconfig.json`). Run the type checker at any time:

```bash
npx tsc --noEmit
```

Cloudflare Worker types are generated from your `wrangler.jsonc` binding configuration:

```bash
npm run generate-types
```

This outputs a `.d.ts` file that gives type-safe access to Cloudflare bindings (KV, D1, etc.) in API routes.

---

## 9. Linting & Formatting

The project does not bundle a linter config by default. To add ESLint + Prettier:

```bash
npm install -D eslint prettier eslint-plugin-astro @typescript-eslint/eslint-plugin
```

---

## 10. Environment Variables

No `.env` file is required for local development. API routes that need secrets should declare them as Cloudflare bindings in `wrangler.jsonc` and access them via `context.locals.runtime.env`.

For local testing with secrets, create a `.dev.vars` file (automatically loaded by Wrangler's `platformProxy`):

```
MY_SECRET=local_value
```

> Never commit `.dev.vars` to version control. Add it to `.gitignore`.

---

## 11. Debugging

- **API routes:** Add `console.log()` — output appears in the terminal running `npm run dev`.
- **React components:** Use the browser DevTools console and React DevTools extension.
- **Routing issues:** The client-side router in `src/lib/router.ts` uses `window.location.hash`. Navigate to `/#ip_discovery` to deep-link to a panel.
- **CF edge data locally:** The `platformProxy` provides a simulated `cf` object. Real geolocation data is only available after deploying to Cloudflare.

---

## 12. Common Issues

| Problem | Solution |
|---------|----------|
| `npm install` fails | Ensure Node >= 18.17.1 (`node --version`) |
| Port 4321 already in use | `npm run dev -- --port 3000` |
| IP data shows as undefined | Expected locally; `request.cf` is only real on the CF edge |
| Type errors after adding bindings | Run `npm run generate-types` |
| Styles not applying | Ensure the class is not purged — add to Tailwind content globs in `tailwind.config.cjs` |
