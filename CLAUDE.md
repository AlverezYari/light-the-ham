# CLAUDE.md — guidance for AI sessions on Light the Ham

This file is the first thing future Claude sessions should read in this repo. It sets context, points at the right files, and flags the things that will bite you if you miss them.

## What this is

**Light the Ham** is a community-driven map of Christmas light displays in the Greater Birmingham, AL metro. Visitors browse, rate (1–5 torches), photograph, and add tips on displays. Owners can claim properties. Admins moderate. Users can build and share custom driving tours.

Public site: `https://lighttheham.com`. The 2025 season was a hot-built alpha/beta. **2026 is the proper public debut.**

## What to read first

| Topic | Path |
|---|---|
| Tech stack one-liners | `docs/STACK.md` |
| Dev loop, branch policy, PR conventions | `CONTRIBUTING.md` |
| Deploy pipeline, rollback, on-call | `docs/RUNBOOK.md` |
| README (user-facing project intro) | `README.md` |
| The active improvement plan (2026 spring cleaning) | `~/.claude/plans/golden-dreaming-shannon.md` (lives outside the repo) |

## Project map

```
src/
├── components/            # Astro components (PropertyMap, TorchRating)
├── layouts/BaseLayout.astro
├── lib/
│   ├── auth.ts            # Session + OAuth glue (Arctic). Cookie hardening lives here.
│   ├── db/{index,schema}.ts  # Drizzle schema + connection
│   ├── geocode.ts         # Google Maps geocoding wrapper
│   └── metrics.ts         # prom-client registry + business counters
├── middleware.ts          # Per-request metrics wrapper. Add rate-limit / CSRF / request-id here.
├── pages/                 # Astro pages (also house API routes under api/)
│   ├── api/
│   │   ├── auth/google/   # Google OAuth handlers (only provider wired)
│   │   ├── admin/         # Moderator endpoints
│   │   ├── claims/, photos/, tips/, tours/, properties.ts, rate.ts, submit.ts, upload.ts
│   │   └── ...
│   └── *.astro            # User-facing pages
└── styles/global.css

scripts/
├── seed.ts, init-season.ts, make-admins.ts, check-status.ts
└── (migrate-add-tours.sql, run-tours-migration.sh — dead code, slated for deletion)
```

## How it deploys (the very short version)

1. `task release` → builds an amd64 image → pushes to `zot.phillips-homelab.net/light-the-ham:<tag>`.
2. **ArgoCD** (configured in `../phillips-homelab/gitops/tools/apps/lighttheham.yaml`, auto-sync on) reconciles the cluster from `../phillips-homelab/gitops/apps/lighttheham/`.
3. The Pod has an init container (Litestream restore from Garage S3) and a sidecar (Litestream replicate to Garage S3). Single replica, Recreate strategy — there is exactly one writer at a time.

Full pipeline + rollback steps live in `docs/RUNBOOK.md`.

## Things that will surprise you (so they don't)

- **`docs/` is partially ignored.** Tracked docs live directly under `docs/*.md`. Anything under `docs/local/` is gitignored for personal scratch.
- **The runtime k8s manifests are in a sibling repo** (`../phillips-homelab/`). Changes that touch the deployment, secrets, network policy, or Grafana dashboard need a coordinated commit there too.
- **OAuth secrets are managed by ExternalSecrets**, not `.env`, in production. The k8s `ExternalSecret` provides Google client ID + secret. The schema's `users.oauthProvider` enum still reserves `'apple'` and `'facebook'` for forward-compatibility — adding a provider doesn't need a schema migration, just an Arctic constructor in `src/lib/auth.ts`, route handlers under `src/pages/api/auth/<provider>/`, an ExternalSecret in `phillips-homelab`, and a button on `login.astro`.
- **Litestream is the durability story.** SQLite lives on a PVC, but Litestream replicates to Garage S3 every 5s. Init container restores on pod start. Anything that drops or rewrites the DB file (e.g. `drizzle-kit push --force`) is dangerous against this flow.
- **`docker-entrypoint.sh` currently runs `drizzle-kit push --force`** — this is a known bug, scheduled for replacement with `drizzle-kit migrate` in Phase 1 of the spring cleaning. Don't double down on `push --force`; help fix it instead.

## Things to never break

1. **The Litestream chain.** If you change the Dockerfile, entrypoint, PVC mount path, or DB filename, coordinate with the `gitops/apps/lighttheham/configmap.yaml` (`/app/data/lighttheham.db`) and `deployment.yaml` (init container args). The 2025 season's data is irreplaceable.
2. **Schema migration discipline.** Once Phase 1 ships proper migrations, never edit a committed migration file. New change = new migration. Drizzle config: `drizzle.config.ts` (output to `./drizzle`).
3. **The `seasons` table.** It's the multi-tenant root for the year-over-year data model. Don't delete or repurpose old seasons — archive them by setting `status: 'archived'`.
4. **Admin role gating.** `users.role === 'admin'` is the only thing standing between a normal user and the moderation endpoints. Auth checks happen in each handler; don't bypass them in middleware.

## Conventions to follow

- **TypeScript strict.** No `any` unless flagged with a `// FIXME(any):` comment and a reason.
- **Drizzle for all DB access.** No raw SQL. Add indexes via the table definition's third arg, not `CREATE INDEX` statements.
- **Astro pages are static-by-default.** API routes and any page needing per-request data must `export const prerender = false;`.
- **No comments that just restate the code.** Only write a comment for *why*, not *what*. (Match the project's existing style — most files are well-named, lightly commented.)
- **Keep the metrics taxonomy intact.** Business metric names start with `lth_`. The Grafana dashboard hardcodes these names; renaming them silently breaks panels.

## When in doubt

Read the most recent commits (`git log --oneline -20`), check the active plan file referenced above, and ask Casey before:
- Deleting files (especially anything in `scripts/` or unused-looking endpoints).
- Changing the deployment shape (Dockerfile, entrypoint, env contract).
- Touching the schema in a way that requires a destructive migration.
