# Self-Hosting & Zero-Worker-Quota Container Deployment

Perks Reminder ships as a standalone Node.js 22 container (`output: 'standalone'` in `next.config.ts` + multi-stage `Dockerfile`). Running the Next.js server in a container behind **Cloudflare DNS + Cache Rules** (without Cloudflare Workers / OpenNext) avoids Workers Free limits (3 MiB bundle cap, 10 ms CPU budget, 100k req/day) while keeping public catalog and landing pages edge-cached at Cloudflare.

This guide covers three zero-cost container hosts: **Koyeb Free**, **Render Free**, and **Oracle Cloud Always Free**.

---

## 1. Environment Variables

Configure these in your container host's runtime environment. Never bake production secrets into the Docker image.

### Required at Runtime

| Variable | Example / Format | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@ep-xxx-pooler.us-west-2.aws.neon.tech/neondb?sslmode=require&connection_limit=10&pool_timeout=20` | Neon **pooler** URL used by Prisma for all runtime queries. |
| `DIRECT_URL` | `postgresql://user:pass@ep-xxx.us-west-2.aws.neon.tech/neondb?sslmode=require` | Neon **direct** (non-pooler) URL required by `prisma/schema.prisma` and attended migrations (`npm run db:prod:migrate`). |
| `NEXTAUTH_URL` | `https://www.perks-reminder.com` | Canonical auth origin for OAuth callbacks, email links, and shared subdomain cookies (`.perks-reminder.com`). |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | NextAuth JWT signing and session-version HMAC secret. |
| `CRON_SECRET` | `openssl rand -hex 32` | Shared `Bearer` token protecting `/api/cron/check-benefits` and `/api/cron/send-notifications`. Must match the GitHub Actions secret. |

### Auth, Email & Site URL

| Variable | Example / Format | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://www.perks-reminder.com` | Canonical site URL for metadata, JSON-LD, and sitemaps (defaults to `https://www.perks-reminder.com` if unset). |
| `GOOGLE_CLIENT_ID` | `*.apps.googleusercontent.com` | Google OAuth client ID (callback: `https://www.perks-reminder.com/api/auth/callback/google`). |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-...` | Google OAuth client secret. |
| `GITHUB_CLIENT_ID` | GitHub OAuth App ID | GitHub OAuth client ID (callback: `https://www.perks-reminder.com/api/auth/callback/github`). |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret | GitHub OAuth client secret. |
| `RESEND_API_KEY` | `re_...` | Resend API key for verification, password reset, and daily digest emails. |
| `FROM_EMAIL` | `Perks Reminder <notifications@perks-reminder.com>` | Verified sender address in Resend. |

### Container & Optional

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `production` | Set in `Dockerfile`. |
| `HOSTNAME` | `0.0.0.0` | Required so Next.js standalone binds all interfaces inside the container. |
| `PORT` | `3000` | Listening port exposed by `Dockerfile`. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js build/runtime telemetry. |
| `GOOGLE_SEARCH_CONSOLE_VERIFICATION` | *(optional)* | Renders `<meta name="google-site-verification" ...>` in `src/app/layout.tsx`. |
| `TZ` | `UTC` *(optional)* | Reported by `/api/monitoring/health`. |

> **Database migrations:** Never run `prisma migrate deploy` inside `Dockerfile` or on container boot. Apply schema migrations explicitly from an authorized workstation with `npm run db:prod:migrate` before deploying code that depends on new columns.

---

## 2. Deploy on Koyeb Free

Koyeb Free runs a Docker web service directly from GitHub with automatic rebuilds on push to `main` and a `512 MB` RAM / `0.1 vCPU` nano instance (sleeps when idle, wakes on HTTP traffic).

1. **Create Web Service:**
   - In the Koyeb Control Panel, click **Create Service → Web Service → GitHub**.
   - Select repository `lifan-builds/perks-reminder`, branch `main`, and enable **Autodeploy**.
2. **Builder Settings:**
   - Select **Dockerfile** as the builder.
   - Dockerfile location: `Dockerfile` (default).
   - Target stage: leave blank (builds final `runner` stage).
3. **Instance & Region:**
   - Choose **Free** instance and the region closest to your Neon Postgres database (e.g., **Washington, D.C.** or **Frankfurt**; match Neon region to minimize query latency).
4. **Exposed Port & Health Check:**
   - Port: `3000` (`HTTP`).
   - Health check: **HTTP**, path `/landing`, port `3000`, grace period `20s`.
   - Use `/landing` instead of `/api/monitoring/health` for liveness checks: `/landing` is strictly DB-free so container health checks do not prevent Neon from scaling to zero.
5. **Environment Variables:**
   - Add all variables from Section 1 (store secrets as Koyeb Secrets).
6. **Custom Domains:**
   - Under **Settings → Domains**, attach `www.perks-reminder.com`, `perks-reminder.com`, and `loyalty.perks-reminder.com`, and copy the CNAME target Koyeb assigns (for Cloudflare DNS in Section 5).

---

## 3. Deploy on Render Free (`render.yaml`)

This repository includes a ready-to-use Blueprint in [`render.yaml`](../render.yaml).

1. Open the Render Dashboard → **New → Blueprint** and connect `lifan-builds/perks-reminder`.
2. Render reads `render.yaml`, configures the Docker service (`plan: free`, `region: oregon`, `healthCheckPath: /landing`), and prompts for every `sync: false` secret from Section 1.
3. Wait for the initial Docker build and verify `/landing` returns `200 OK` on the `*.onrender.com` URL.
4. Under **Settings → Custom Domains**, add `www.perks-reminder.com`, `perks-reminder.com`, and `loyalty.perks-reminder.com`, then point Cloudflare DNS to Render's target (Section 5).
5. Note that Render Free spins down after 15 minutes of inactivity; Cloudflare Cache Rules keep anonymous public pages fast from the edge while `.github/workflows/daily-crons.yml` warms `/landing` before invoking cron routes.

---

## 4. Deploy on Oracle Cloud Always Free (Zero Cold Starts)

Oracle Cloud Always Free provides up to 4 ARM Ampere A1 OCPUs and 24 GB RAM (or 2 AMD Micro VMs) with no sleep/cold-start penalty and enough headroom to co-host Umami (`stats.clifan.com`).

1. Provision an Ubuntu 24.04 ARM (Ampere A1) VM and allow inbound TCP `80` and `443` in both Oracle VCN Security Lists and `ufw`.
2. Install Docker Engine + Compose plugin and clone the repository:
   ```bash
   git clone https://github.com/lifan-builds/perks-reminder.git /opt/perks-reminder
   cd /opt/perks-reminder
   ```
3. Create `/opt/perks-reminder/.env.production` (mode `600`) with all runtime variables from Section 1.
4. Build and run the container behind Caddy (or Nginx) on `127.0.0.1:3000`:
   ```bash
   docker build -t perks-reminder:latest .
   docker run -d --name perks-reminder --restart unless-stopped \
     -p 127.0.0.1:3000:3000 \
     --env-file /opt/perks-reminder/.env.production \
     perks-reminder:latest
   ```
5. Reverse-proxy `perks-reminder.com`, `www.perks-reminder.com`, and `loyalty.perks-reminder.com` to `127.0.0.1:3000` with Caddy (or Cloudflare Origin Certificate + Nginx), preserving `Host`, `X-Forwarded-For`, and `X-Forwarded-Proto`.

---

## 5. Cloudflare DNS & Cache Rules (Zero Worker Quota)

Cloudflare Free includes unlimited proxied DNS, Universal SSL, and **10 Cache Rules** without touching Cloudflare Workers quota.

### DNS Records

| Type | Name | Target | Proxy Status |
| --- | --- | --- | --- |
| `CNAME` (or `A`) | `@` (`perks-reminder.com`) | Koyeb / Render target (or Oracle VM public IP) | Proxied (orange cloud) |
| `CNAME` (or `A`) | `www` | Same target | Proxied (orange cloud) |
| `CNAME` (or `A`) | `loyalty` | Same target (handled by `src/proxy.ts`) | Proxied (orange cloud) |

- Set **SSL/TLS → Overview** to **Full (strict)**.
- Optional **Rules → Redirect Rules**: `301` redirect `https://perks-reminder.com/*` → `https://www.perks-reminder.com/$1` (do **not** redirect `loyalty.perks-reminder.com`).

### Cache Rules (Order Matters)

Configure under **Caching → Cache Rules**. All public HTML rules MUST check `not http.cookie contains "next-auth.session-token"` (which matches both `next-auth.session-token` and `__Secure-next-auth.session-token`) so signed-in sessions never receive cached anonymous HTML.

1. **Rule 1 — Bypass Authenticated, API & Private Routes**
   - Expression:
     ```text
     (http.cookie contains "next-auth.session-token")
     or starts_with(http.request.uri.path, "/api/")
     or starts_with(http.request.uri.path, "/auth/")
     or starts_with(http.request.uri.path, "/integrations/")
     or http.request.uri.path in {"/cards" "/cards/new" "/benefits" "/benefits/custom" "/loyalty" "/settings"}
     ```
   - Action: **Bypass cache**.

2. **Rule 2 — Immutable Next.js Static Assets**
   - Expression:
     ```text
     starts_with(http.request.uri.path, "/_next/static/")
     or starts_with(http.request.uri.path, "/images/")
     or starts_with(http.request.uri.path, "/icons/")
     or http.request.uri.path in {"/favicon.png" "/manifest.json" "/robots.txt" "/sitemap.xml"}
     ```
   - Action: **Eligible for cache**
   - Edge TTL: **Use cache-control header if present, cache request if not** (`1 year` for `/_next/static/*`, `1 day` for icons/manifest).
   - Browser TTL: **Respect origin**.

3. **Rule 3 — Anonymous Public Pages**
   - Expression:
     ```text
     (not http.cookie contains "next-auth.session-token") and (
       http.request.uri.path in {
         "/landing"
         "/guide"
         "/cards/browse"
         "/benefits/how-to-use"
         "/expiring"
         "/referrals"
         "/pricing"
         "/privacy"
         "/terms"
         "/contact"
         "/loyalty-landing"
       }
       or starts_with(http.request.uri.path, "/cards/browse/")
       or starts_with(http.request.uri.path, "/benefits/how-to-use/")
       or (http.request.uri.path eq "/" and http.host ne "loyalty.perks-reminder.com")
     )
     ```
   - Action: **Eligible for cache**
   - Edge TTL: **Ignore cache-control header and use this TTL** → `1 hour` (`3600` seconds).
   - Browser TTL: **Override origin** → `5 minutes` (`300` seconds).
   - Note: Keep `loyalty.perks-reminder.com/` either bypassed or on its own rule/cache key because `src/proxy.ts` rewrites `/` differently by host.

---

## 6. Daily Cron Jobs (GitHub Actions)

[`daily-crons.yml`](../.github/workflows/daily-crons.yml) replaces `vercel.json`'s two daily schedules:

| Schedule (UTC) | Endpoint | Purpose |
| --- | --- | --- |
| `0 5 * * *` | `POST /api/cron/check-benefits` | Materializes/updates benefit cycles. |
| `30 5 * * *` | `POST /api/cron/send-notifications` | Sends daily expiration digest emails via Resend. |

### Setup

1. In GitHub → **Settings → Secrets and variables → Actions**, add two repository secrets:
   - `APP_BASE_URL`: `https://www.perks-reminder.com` (no trailing slash required; the workflow strips any trailing `/`).
   - `CRON_SECRET`: exact value configured in the container host.
2. Test safely via **Actions → Daily crons → Run workflow** with `job: check-benefits` and `dry_run: true` (the default for manual runs so Resend emails are never sent accidentally).
3. Before calling either cron endpoint, the workflow sends a warm-up `GET /landing` request so sleeping Koyeb/Render Free containers wake cleanly without triggering retry loops on notification emails.

---

## 7. Analytics: Self-Hosting `stats.clifan.com` (Umami) vs Cloudflare Web Analytics

Currently, [`src/components/PathAwareTelemetry.tsx`](../src/components/PathAwareTelemetry.tsx) only renders when `NEXT_PUBLIC_VERCEL_ENV === "production"` (excluding `/integrations/amex-sync`), loading `https://clifan-umami.vercel.app/script.js` and `@vercel/analytics/next`. On non-Vercel container hosts, it loads nothing until you pick one of the two options below.

### Option A — Self-Host Umami at `stats.clifan.com`

Best if you want to keep first-party Umami dashboards across `clifan.com` and `perks-reminder.com` without Vercel.

1. Run the official Umami container (`ghcr.io/umami-software/umami:postgresql-latest`) on your Oracle Always Free VM (or a second Koyeb/Render service) backed by a dedicated Postgres database (`DATABASE_URL` + `APP_SECRET`):
   ```bash
   docker run -d --name umami --restart unless-stopped \
     -p 127.0.0.1:3001:3000 \
     -e DATABASE_URL="postgresql://..." \
     -e APP_SECRET="$(openssl rand -hex 32)" \
     ghcr.io/umami-software/umami:postgresql-latest
   ```
2. Add a proxied Cloudflare DNS record for `stats.clifan.com` pointing to the Umami host and reverse-proxy `https://stats.clifan.com` → `127.0.0.1:3001`.
3. Update `src/components/PathAwareTelemetry.tsx` (and its unit test) to:
   - Gate on a host-agnostic production flag (for example `process.env.NEXT_PUBLIC_TELEMETRY_URL`, set at build/runtime to `https://stats.clifan.com`) instead of `NEXT_PUBLIC_VERCEL_ENV`.
   - Load `${telemetryOrigin}/script.js` (with `data-website-id` or `data-site="perks-reminder.com"` matching your Umami setup).
   - Remove `<Analytics />` (`@vercel/analytics/next`) so `/_vercel/insights` is never requested off-Vercel.
   - Keep `pathname === "/integrations/amex-sync"` excluded so the private Amex sync handoff remains zero-telemetry.

### Option B — Switch to Cloudflare Web Analytics (Zero Hosting)

Best if you want zero extra containers or databases and zero Cloudflare Worker quota.

1. Open Cloudflare Dashboard → **Analytics & Logs → Web Analytics → Add a site** for `perks-reminder.com`.
2. Choose **Manual JS snippet** (recommended over Automatic Setup so `/integrations/amex-sync` stays strictly telemetry-free):
   - Copy the site token (`{"token": "..."}`).
   - Add `NEXT_PUBLIC_CF_BEACON_TOKEN` and load `https://static.cloudflareinsights.com/beacon.min.js` inside `src/components/PathAwareTelemetry.tsx` when `pathname !== "/integrations/amex-sync"`, removing `@vercel/analytics/next`.
   - Alternatively, if you enable Cloudflare's Automatic Setup on the proxied zone, add a **Cloudflare Configuration Rule** for `http.request.uri.path eq "/integrations/amex-sync"` that disables **RUM (Web Analytics)** on that route.

---

## 8. Post-Deploy Verification

1. Run the repository health and latency check against your live URL (never touches `/api/cron/*`):
   ```bash
   npm run health -- --base-url https://www.perks-reminder.com
   ```
2. Confirm edge caching on anonymous public pages (`CF-Cache-Status: HIT` on the second request):
   ```bash
   curl -sI https://www.perks-reminder.com/landing | grep -iE 'HTTP/|cf-cache-status|cache-control'
   curl -sI https://www.perks-reminder.com/guide | grep -iE 'HTTP/|cf-cache-status|cache-control'
   curl -sI https://www.perks-reminder.com/cards/browse | grep -iE 'HTTP/|cf-cache-status|cache-control'
   ```
3. Confirm `/api/monitoring/health` returns `200` with `"status": "healthy"` and `CF-Cache-Status: BYPASS` (or `DYNAMIC`).
4. Verify Google/GitHub OAuth login on `https://www.perks-reminder.com/auth/signin` and confirm `https://loyalty.perks-reminder.com/` renders the loyalty landing page.
