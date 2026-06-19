# Deploying NetPulse to Cloudflare Pages

NetPulse is a server-side rendered (SSR) Astro app backed by Cloudflare Workers. Cloudflare Pages with Workers support is the primary deployment target.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | >= 18.17.1 | Required for local build |
| npm | >= 9 | Comes with Node.js |
| Wrangler CLI | >= 4 | Already in `devDependencies`; also available globally |
| Cloudflare account | Free tier | [Sign up at dash.cloudflare.com](https://dash.cloudflare.com/sign-up) |

---

## Overview

There are two deployment paths:

| Method | Best for |
|--------|----------|
| **Wrangler CLI** (recommended) | Scripted deploys, CI/CD, full control |
| **Cloudflare Pages Git integration** | Automatic deploys on every push |

---

## Method 1: Deploy with Wrangler CLI

### Step 1 — Authenticate Wrangler

```bash
npx wrangler login
```

This opens a browser window. Log in with your Cloudflare account. Your credentials are stored locally.

Verify authentication:

```bash
npx wrangler whoami
```

### Step 2 — Build the App

```bash
npm run build
```

The production bundle is written to `./dist/`. Astro compiles SSR routes into Cloudflare Worker scripts.

### Step 3 — Deploy

```bash
npx wrangler deploy
```

Wrangler reads `wrangler.jsonc` in the project root and deploys to Cloudflare Workers. On your first deploy it will:
1. Create a new Workers project automatically.
2. Upload the `./dist/` assets.
3. Return a `*.workers.dev` URL you can open immediately.

Expected output:

```
 ⛅️ wrangler 4.x.x
─────────────────
Total Upload: xxx KiB / gzip: xxx KiB
Your Worker has access to the following bindings:
Uploaded netpulse (xx sec)
Deployed netpulse triggers (xx sec)
  https://netpulse.<your-subdomain>.workers.dev
```

### Step 4 (Optional) — Add a Custom Domain

In the Cloudflare dashboard:
1. Go to **Workers & Pages** → your project → **Settings** → **Domains & Routes**.
2. Click **Add Custom Domain**.
3. Enter your domain (must be on Cloudflare DNS).
4. Cloudflare automatically provisions an SSL certificate.

---

## Method 2: Cloudflare Pages Git Integration (Auto-Deploy)

This connects your GitHub/GitLab repo so every push to `main` triggers a production deploy.

### Step 1 — Push Code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/<your-username>/netpulse.git
git push -u origin main
```

### Step 2 — Create a Pages Project

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com).
2. Go to **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Authorize Cloudflare to access your GitHub account.
4. Select the `netpulse` repository.
5. Click **Begin setup**.

### Step 3 — Configure Build Settings

| Field | Value |
|-------|-------|
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (leave blank) |
| Node.js version | `18` |

Set the Node.js version explicitly via an environment variable:

| Variable | Value |
|----------|-------|
| `NODE_VERSION` | `18` |

### Step 4 — Deploy

Click **Save and Deploy**. Cloudflare runs the build and publishes the result. Monitor progress in the **Deployments** tab.

After deploy you get:
- A `*.pages.dev` URL for immediate access.
- Automatic preview deployments for every pull request.
- Automatic production deploys on every push to `main`.

---

## Environment Variables & Secrets

For any secrets the app needs (API keys, tokens):

**Via Wrangler CLI:**
```bash
npx wrangler secret put MY_SECRET_KEY
# Prompts you to paste the value
```

List existing secrets:
```bash
npx wrangler secret list
```

**Via Cloudflare Dashboard:**
1. **Workers & Pages** → your project → **Settings** → **Variables and Secrets**.
2. Click **Add variable** (plain text) or **Add secret** (encrypted at rest).

Secrets are available in API route handlers via `context.locals.runtime.env`:

```ts
// src/pages/api/example.ts
import type { APIRoute } from 'astro'

export const GET: APIRoute = async ({ locals }) => {
  const { MY_SECRET_KEY } = locals.runtime.env
  // ...
}
```

---

## Preview Deployments

Wrangler supports named environments. To deploy a staging version:

1. Add an `[env.staging]` block in `wrangler.jsonc`:
   ```jsonc
   [env.staging]
   name = "netpulse-staging"
   ```

2. Deploy to staging:
   ```bash
   npx wrangler deploy --env staging
   ```

---

## Rollback

List recent deployments:
```bash
npx wrangler deployments list
```

Roll back to a specific deployment ID:
```bash
npx wrangler rollback <deployment-id>
```

Or roll back to the previous deployment:
```bash
npx wrangler rollback
```

---

## Verify the Deployment

After deploying, confirm the app is working:

```bash
# Fetch your IP data from the live edge
curl https://netpulse.<your-subdomain>.workers.dev/api/ip

# Check the config endpoint
curl https://netpulse.<your-subdomain>.workers.dev/api/config
```

Expected `/api/ip` response when accessed from the live edge:

```json
{
  "ip": "x.x.x.x",
  "asn": "AS12345",
  "isp": "Your ISP",
  "city": "Your City",
  "region": "Your Region",
  "country": "US",
  "latitude": "xx.xxxx",
  "longitude": "xx.xxxx",
  ...
}
```

---

## Free Tier Limits (Cloudflare Workers)

| Resource | Free Tier Limit |
|----------|----------------|
| Requests/day | 100,000 |
| CPU time/request | 10 ms |
| Memory/request | 128 MB |
| Subrequests/request | 50 |
| Workers scripts | 100 |
| Custom domains | Unlimited (if on Cloudflare DNS) |

NetPulse is stateless and lightweight — it comfortably runs within the free tier for personal and small-scale use.

---

## Common Issues

| Problem | Solution |
|---------|----------|
| `wrangler login` hangs | Use `npx wrangler login --browser=false` and open the printed URL manually |
| Build fails on Pages | Set `NODE_VERSION=18` in environment variables |
| `request.cf` returns `undefined` | The `cf` object is only populated on real Cloudflare edge requests, not during `wrangler dev` local simulation |
| 404 on all routes | Verify the build output directory is set to `dist` in Pages settings |
| Assets not loading | Confirm `public/_headers` is in the repo root and not gitignored |
| Deploy rejected — size limit | Per-file max is **25 MiB** (not total deploy). Gigabit preset uses 4×25 MiB chunks (~100 MB total). Generate via build script; keep `*.bin` gitignored. |
