# Vercel: Domains & Deployment

## Live Domains

| Domain | Purpose | Status |
|--------|---------|--------|
| `perks-reminder.com` | Main app — credit card benefits | Live and renders the main app; Vercel reports **DNS Change Recommended** (the existing target remains supported) |
| `www.perks-reminder.com` | Primary main app domain | Live and renders the main app; Vercel reports **DNS Change Recommended** (the existing target remains supported) |
| `loyalty.perks-reminder.com` | Loyalty program landing page | Live and renders the loyalty landing page; Vercel reports **DNS Change Recommended** (the existing target remains supported) |
| `coupon-cycle.site` | Obsolete legacy domain | Removed from the Vercel project on 2026-09-07; DNS resolution still fails |
| `www.coupon-cycle.site` | Obsolete legacy domain | Removed from the Vercel project on 2026-09-07; DNS resolution still fails |
| `loyalty.coupon-cycle.site` | Obsolete legacy domain | Removed from the Vercel project on 2026-09-07; DNS resolution still fails |

The production target is the Vercel `coupon-cycle` project in the `lifan-chens-projects` team, connected to `lifan-builds/perks-reminder`. The latest verified Ready production deployment (2026-09-03) serves `www.perks-reminder.com`. At verification time, the three live `perks-reminder.com` names use the supported `76.76.21.21` target; Vercel recommends `216.198.79.1` for the apex and `1ef24fc23a740e62.vercel-dns-017.com` CNAMEs for `www` and `loyalty`. The **DNS Change Recommended** state remains unresolved because the Spaceship session expired before the records could be reviewed or changed. Re-check the Dashboard before any later change because provider recommendations can change.

The obsolete `coupon-cycle.site` configurations were removed from the Vercel project on 2026-09-07. Public `1.1.1.1` and `8.8.8.8` lookups still return `NXDOMAIN` for the domain's NS records, while a local resolver may surface the failure as `SERVFAIL`. Removing the Vercel configurations did not repair public DNS or restore redirects. The `loyalty` subdomain is detected by Next.js middleware (`src/middleware.ts`) which rewrites `/` → `/loyalty-landing` when it reaches the application.

## Adding a New Subdomain

1. In the Vercel Dashboard, select team **Lifan Chen's projects**, open project **coupon-cycle**, then go to **Settings → Domains → Add**. Confirm both the team and project before submitting the domain change. Do not rewrite this checkout's ignored `.vercel/project.json`; it may be linked to another project and is not evidence of the production target.

2. **DNS**: Use the exact record Vercel displays for the domain at action time:
   - **Type**: the provider-supplied record type
   - **Name**: `<subdomain>` or the provider-supplied host
   - **Value**: the provider-supplied target

   Preview the registrar change, obtain production authorization, and define rollback before submitting it. A **DNS Change Recommended** warning is not proof that an existing supported target has stopped working.

3. **Middleware**: Update `src/middleware.ts` if application routing must recognize the new subdomain.

---

## Build Command

```bash
npm run build
```

- Vercel uses the repository's default `npm run build` command
- The package script expands to `prisma generate && next build`: it generates the client and compiles the application without applying migrations
- The production project uses Node.js 22.x
- Generic Preview and Production builds do not run migrations
- `npm run db:prod:migrate` is the separate attended migration command and requires explicit authorization plus immediate target and recovery verification

## Required Vercel Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon **pooler** endpoint (has `-pooler` in hostname) |
| `DIRECT_URL` | Neon **direct** endpoint (no `-pooler`) — required for `prisma migrate deploy` |
| `DATABASE_URL_DEV` | Development database branch |
| `NEXTAUTH_URL` | Production URL (`https://www.perks-reminder.com`) |
| `NEXTAUTH_SECRET` | NextAuth secret key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth client ID |
| `FACEBOOK_CLIENT_SECRET` | Facebook OAuth client secret |
| `RESEND_API_KEY` | Resend email service API key |
| `FROM_EMAIL` | Sender email address |
| `CRON_SECRET` | Secret for cron job authorization |
| `SERPAPI_API_KEY` | SerpApi key for card image downloads |
| `GOOGLE_ANALYTICS_ID` | Google Analytics measurement ID |

### Why DIRECT_URL?

Neon provides two connection endpoints:
- **Pooler** (`-pooler`): Connection pooling for app queries — handles many concurrent connections efficiently
- **Direct** (no `-pooler`): Direct PostgreSQL connection — required by `prisma migrate deploy` because it uses advisory locks (`SELECT pg_advisory_lock(...)`) which don't work through poolers

The Prisma schema uses both:
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // pooler — used by app queries
  directUrl = env("DIRECT_URL")        // direct — used by migrations
}
```

### Managing Environment Variables

Manage production values in **Lifan Chen's projects → coupon-cycle → Settings → Environment Variables**. Verify the variable name and environment target before saving. Mark secrets as sensitive, and never copy values into tracked files, screenshots, task evidence, or shell output.

If an authorized operation specifically requires the CLI, first link an isolated temporary working directory to the exact `coupon-cycle` project and `lifan-chens-projects` scope. Do not relink this checkout. Supply finite values with EOF-terminated stdin (`printf %s`), because `echo` adds a newline that can change exact configuration values. Do not run an unscoped `vercel env pull`; sensitive values may be omitted, and pulling provider configuration into the repository creates a secret-handling risk.

---

## If a Deployment Failed

### Where to look

1. **Vercel Dashboard** → Project (`coupon-cycle`) → Deployments → open the failed deployment
2. Check **Build logs** for the specific error

### Common causes

| Cause | What you see | Fix |
|-------|-------------|-----|
| **DB timeout (advisory lock)** | `P1002: Timed out trying to acquire a postgres advisory lock` during the attended migration gate | Stop the migration, re-verify the direct target and recovery plan, and do not treat an application build as a retry. |
| **Missing DIRECT_URL** | `Environment variable not found: DIRECT_URL` during the attended migration gate | Stop before deployment and restore the approved direct migration configuration without copying its value into project files. |
| **Wrong workspace root** | "multiple lockfiles" warning | Fixed with `outputFileTracingRoot` in `next.config.ts`. |
| **Missing env vars** | Build or runtime fails on missing variables | Add all variables from the table above in Vercel Settings → Environment Variables. |
| **Prisma client issues** | Errors about `@prisma/client` or generated client | Build command already runs `prisma generate` first. |
| **Node version** | Incompatible Node or lockfile issues | Verify the production project remains set to Node.js 22.x in Vercel Settings → Build and Deployment. |

### Re-run a failed deployment

GitHub `main` deploys automatically. Fix the concrete failure, run the relevant local checks, and send the reviewed change through the normal Git workflow. A merge or push to `main` is a production release. Redeploying an unchanged deployment from the Dashboard or running a manual production deployment requires explicit authorization; do not create an empty commit solely to trigger production.

---

## Vercel Project IDs (Reference)

| Project | ID | Notes |
|---------|-----|-------|
| `coupon-cycle` | `prj_x0VAgiuO3PAem4IUmeVo9dsRMCsx` | Production deployments from GitHub |
| `credit-card-tracker` | `prj_ng6vVQVQXr5XWUQmbYcPk6JOTRRc` | CLI-linked project (local `.vercel/project.json`) |
| Team | `team_IVhBm6B2M4mIXzermYdxeqRK` | "Lifan Chen's projects" |
