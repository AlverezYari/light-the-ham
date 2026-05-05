# Stack at a glance

A one-liner per tool — what it is, what role it plays, where to read more. Read this first if you're new to the project. Subsequent docs (`CONTRIBUTING.md`, `RUNBOOK.md`) assume you've skimmed this.

## Application layer (in this repo)

- **[Astro](https://astro.build)** — the web framework. Renders pages on the server (SSR via `@astrojs/node`) and ships minimal JS to the browser. Think "Next.js, but content-first and less JS by default." Pages live in `src/pages/`; API routes are just `.ts` files under `src/pages/api/`.
- **[TypeScript](https://www.typescriptlang.org)** — JavaScript with types. The compiler (`tsc --noEmit`) catches a huge class of bugs before they run.
- **[Drizzle ORM](https://orm.drizzle.team)** — type-safe database access. You define your schema in TypeScript (`src/lib/db/schema.ts`); Drizzle generates the SQL and gives you typed query builders. The CLI (`drizzle-kit`) handles migrations.
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** — synchronous SQLite driver for Node. Fast, embedded, single-file database. Great for low-write workloads like ours.
- **[Tailwind CSS v4](https://tailwindcss.com)** — utility-first CSS. Instead of writing `.button { padding: 0.5rem 1rem; ... }`, you write `class="px-4 py-2 ..."` directly in markup.
- **[Leaflet](https://leafletjs.com)** — open-source map rendering library. Used for the property map with marker clustering.
- **[Arctic](https://arcticjs.dev)** — small, audited OAuth client library. Currently wired for Google only; Arctic supports Apple, Facebook, GitHub, etc. if/when we add more providers.
- **[prom-client](https://github.com/siimon/prom-client)** — Prometheus metrics for Node. Exposes counters/histograms/gauges at `/metrics` for VictoriaMetrics to scrape.
- **[pnpm](https://pnpm.io)** — package manager. Same role as `npm` or `yarn`, but uses a content-addressable store so disk usage stays tiny across projects.
- **[Task](https://taskfile.dev)** — task runner (a `Makefile` replacement written in Go). The `Taskfile.yaml` defines `task dev`, `task release`, etc.

## Dev tooling we add on top

- **[Biome](https://biomejs.dev)** — single-binary linter + formatter. Replaces ESLint + Prettier. One config file, ~10× faster, no plugin ecosystem to fight with. Run via `task fmt` / `task lint`.
- **[Vitest](https://vitest.dev)** — Vite-powered test runner. Jest-compatible API but faster startup, native ESM, and works with Astro's existing Vite pipeline. Run via `task test`.
- **[GitHub Actions](https://docs.github.com/en/actions)** — CI/CD platform built into GitHub. We use it just for CI (typecheck/lint/test/build) — actual deployment stays with ArgoCD.
- **[pino](https://getpino.io)** — structured (JSON) logger for Node. Faster than alternatives and fits Loki's label-based search model. (Phase 2 — not yet wired.)
- **[Dependabot](https://docs.github.com/en/code-security/dependabot)** — automated dependency-bump PRs. Keeps the lockfile fresh without manual chores.

## Hosting & infrastructure (in `../phillips-homelab/`)

- **[Talos Linux](https://www.talos.dev)** — minimal, immutable, API-driven Linux distro built specifically to run Kubernetes. No SSH, no shell — you configure it via API.
- **[Kubernetes](https://kubernetes.io)** — the container orchestrator. Runs the app pod, mounts storage, restarts on crash, applies network policies.
- **[ArgoCD](https://argo-cd.readthedocs.io)** — GitOps controller. Watches the `phillips-homelab` repo and reconciles the cluster to match. To deploy, you commit YAML — Argo applies it. Auto-sync, prune, and self-heal are all on.
- **[Cilium](https://cilium.io)** — CNI (cluster networking) with eBPF. Provides the `CiliumNetworkPolicy` that locks ingress to Cloudflare-tunnel and monitoring traffic only.
- **[Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/)** — outbound-only tunnel from a cluster pod to Cloudflare's edge. Public traffic terminates at Cloudflare (TLS, DDoS protection, DNS) and reaches the app over the tunnel — no public IP exposed.
- **[Litestream](https://litestream.io)** — streams every SQLite transaction to S3 in near-real-time (5s sync interval). An init container restores the DB on pod start; a sidecar replicates while it runs. This is why we can use single-replica SQLite in production without losing data.
- **[Garage](https://garagehq.deuxfleurs.fr)** — self-hosted, S3-compatible object store. Holds the Litestream snapshots (and will hold CNPG/Barman backups when we migrate to Postgres).
- **[VictoriaMetrics](https://victoriametrics.com)** — Prometheus-compatible time-series database. Scrapes `/metrics` every 30s via the `VMServiceScrape` CRD. Stores cheaper and queries faster than vanilla Prometheus at our scale.
- **[Grafana](https://grafana.com)** + **[Loki](https://grafana.com/oss/loki/)** — dashboards (Grafana) and log aggregation (Loki). The `lighttheham.json` dashboard already wires both: Prom metrics on top, raw Loki logs in a panel at the bottom.
- **[External Secrets Operator](https://external-secrets.io)** — pulls real secrets from a `ClusterSecretStore` and projects them into the cluster as native `Secret` objects. Means no secrets in git.
- **[Zot](https://zotregistry.dev)** — self-hosted OCI container registry at `zot.phillips-homelab.net`. `task release` builds and pushes the image here.

## Future stack (for the SQLite → Postgres migration)

- **[CloudNativePG (CNPG)](https://cloudnative-pg.io)** — Postgres-on-Kubernetes operator. Already running in the cluster. Handles HA, failover, backups, monitoring, and rolling upgrades for Postgres.
- **[Barman](https://pgbarman.org)** (via the CNPG plugin) — Postgres backup/recovery tool. Streams WAL segments to S3 (Garage) for point-in-time recovery.

## How the pieces talk

```
            ┌──────────────┐
 user ────► │  Cloudflare  │ ──TLS termination, DNS, DDoS──┐
            └──────────────┘                                │
                                                            ▼
                                          ┌────────────────────────────┐
                                          │ Cloudflare Tunnel pod (k8s)│
                                          └─────────────┬──────────────┘
                                                        │ ClusterIP
                                                        ▼
                          ┌──────────────────────────────────────────────┐
                          │ Pod: lighttheham                             │
                          │  • app container (Astro, port 4321)          │
                          │  • litestream sidecar (replicate every 5s)   │
                          │  • init: litestream restore (on cold start)  │
                          └──────┬─────────────────────────┬──────────────┘
                                 │                         │
                          PVC: data (SQLite)        PVC: uploads
                                 │                         │
                                 └──── replicates to ──────┘
                                            ▼
                                     ┌─────────────┐
                                     │ Garage S3   │
                                     └─────────────┘

   monitoring ns ──VMServiceScrape /metrics──► VictoriaMetrics ──► Grafana
   (vmagent)                                                          ▲
                                                                Loki ─┘
                                                                  ▲
                                                          (logs from ns)
```
