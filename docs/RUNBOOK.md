# Runbook — Light the Ham

Operational guide for the running production system. Read this when you need to deploy, roll back, debug a live issue, or restore from backup.

For the conceptual map of *what each tool is*, see [`STACK.md`](STACK.md). For *how we collaborate*, see [`../CONTRIBUTING.md`](../CONTRIBUTING.md).

---

## At a glance

| Thing | Location |
|---|---|
| Public site | `https://lighttheham.com` |
| Container registry | `zot.phillips-homelab.net/light-the-ham` |
| K8s manifests | `../phillips-homelab/gitops/apps/lighttheham/` |
| ArgoCD app definition | `../phillips-homelab/gitops/tools/apps/lighttheham.yaml` |
| Grafana dashboard | `../phillips-homelab/gitops/core/grafana-dashboards/lighttheham.yaml` (UID `lighttheham`) |
| Litestream backup bucket | Garage S3, `lighttheham-litestream/db` |
| Cluster | Talos Linux + Kubernetes (homelab) |
| Namespace | `lighttheham` |

---

## Deploy a new version

We deploy by pushing an image; ArgoCD picks it up automatically.

```bash
# from the light-the-ham repo
task release         # builds amd64, tags with git-describe, pushes to Zot
```

`task release` runs: `typecheck → docker:build → docker:push`. The build uses `git describe --tags --always --dirty` for the version tag and also tags `latest`.

Once pushed:

1. ArgoCD has `automated: { prune: true, selfHeal: true }` and is targeting the `:latest` tag → it will detect the change at the next reconciliation and roll the pod.
2. Watch the rollout in the **ArgoCD UI** under app `lighttheham`, or:
   ```bash
   kubectl -n lighttheham rollout status deploy/lighttheham
   ```
3. Confirm the new version is live: hit the site, check the version label in the UI footer (if wired) or the build labels on the running image.

> **Strategy is `Recreate`, not `RollingUpdate`** — there is one writer at a time for SQLite. Expect ~10–30s of downtime per deploy. Acceptable today; revisit when we move to Postgres.

### Pinning to a specific image tag (when `:latest` would be too risky)

For sensitive deploys or holds during the live season, pin the deployment to a specific tag in `phillips-homelab/gitops/apps/lighttheham/deployment.yaml`:

```yaml
image: zot.phillips-homelab.net/light-the-ham:v0.2.3   # not :latest
```

Commit + push to `phillips-homelab` → ArgoCD applies. Remember to un-pin after the freeze.

---

## Roll back

### Fast rollback (image-level)

ArgoCD UI → app `lighttheham` → **History and Rollback** → pick the previous sync → **Rollback**. This re-applies the previous Git revision to the cluster.

If the previous image tag is what changed, you can also pin in `deployment.yaml` (see above) and push.

### CLI rollback

```bash
# Find the previous deployment revision
kubectl -n lighttheham rollout history deploy/lighttheham

# Roll back to the previous one
kubectl -n lighttheham rollout undo deploy/lighttheham

# Or to a specific revision
kubectl -n lighttheham rollout undo deploy/lighttheham --to-revision=N
```

> Note: `kubectl rollout undo` is *transient* — ArgoCD will reconcile back to whatever's in Git on the next sync. For a durable rollback, do it through ArgoCD or commit the pin.

---

## Logs

Logs go to stdout/stderr. Loki collects everything in the `lighttheham` namespace.

### From Grafana (preferred)

Open the **Light the Ham** dashboard. The bottom panel is the live log stream for the namespace. To search:

```logql
{namespace="lighttheham"} |= "claim"           # full-text
{namespace="lighttheham", container="app"}     # app container only
{namespace="lighttheham"} |= "error"           # quick error grep
```

Once Phase 2 ships pino structured logs, you'll be able to filter on JSON fields:

```logql
{namespace="lighttheham"} | json | level="error"
{namespace="lighttheham"} | json | request_id="abc-123"
```

### From kubectl (fast & dirty)

```bash
kubectl -n lighttheham logs -f deploy/lighttheham -c app
kubectl -n lighttheham logs -f deploy/lighttheham -c litestream    # backup sidecar
kubectl -n lighttheham logs --previous deploy/lighttheham -c app   # last crashed container
```

---

## Metrics

Same Grafana dashboard. Top row = HTTP overview (req/s, p95, error rate, active reqs). Middle = HTTP-by-status timeseries + latency percentiles. Bottom = business counters (`lth_*`) and Node.js process metrics.

If something looks weird, jump to VictoriaMetrics directly via the dashboard's data-source link to query freely.

Metric names to know (defined in `src/lib/metrics.ts`):

- `http_requests_total{method, route, status_code}` — every HTTP request, route normalized.
- `http_request_duration_seconds` — Histogram. Use `histogram_quantile()` for percentiles.
- `lth_properties_submitted_total{city}` — submission counter.
- `lth_ratings_submitted_total{rating}` — torch-count distribution.
- `lth_user_logins_total{provider}` — OAuth provider use.
- `lth_active_sessions` — gauge, approximate.

---

## Database migrations

Migrations are versioned. Files live in `drizzle/` and are committed to git.

```bash
# When you change src/lib/db/schema.ts:
pnpm db:generate                    # writes drizzle/<NNNN>_<name>.sql
git add drizzle/                    # commit the migration with the schema change
```

On every container start, `docker-entrypoint.sh` runs `scripts/migrate.ts`. The runner handles three states transparently:

| DB state | Behavior |
|---|---|
| Brand-new file (no tables) | Applies all migrations from scratch. |
| Legacy push-style DB (tables exist, no `__drizzle_migrations` table) | Stamps the journal as already-applied (one-time, automatic), then continues. |
| Already migrated DB | Applies only new migrations; no-op if up-to-date. |

The first deploy of this Phase-1 work hits the second case automatically — no manual stamping required, but you absolutely should snapshot first (see "Labeled snapshots" below). The migration runner also runs inside a transaction, so a partial failure rolls back.

> **Don't ever use `pnpm db:push` (or `--force`) against the production DB.** The Phase-1 entrypoint refuses to do so — it shells `migrate.ts` instead — and the script doesn't accept a `--force` flag for a reason.

## Security middleware

Three layers run before any handler (`src/middleware.ts`):

1. **CSRF** (`src/lib/security/csrf.ts`) — POST/PATCH/DELETE without an Origin or Referer matching `SITE_URL` returns 403. The exempt-path list is currently empty; if Apple OAuth (form_post) or any other cross-origin POST flow is added, allow-list its callback path here.
2. **Rate limit** (`src/lib/security/rate-limit.ts`) — token bucket per `(client-IP, path)` for mutation routes (`/api/rate`, `/api/submit`, `/api/upload`, `/api/photos/upload`, `/api/tips/submit`, `/api/claims/submit`). 30 requests/minute capacity, in-memory.
3. **Metrics** — same Prometheus middleware as before; runs last so 403/429 responses still get counted.

**Caveat**: the rate limiter is in-memory. Pod restart wipes counters; horizontal scale-out (>1 replica) would let an abuser round-robin across pods. Both are fine for current scale (Recreate strategy, 1 replica). When we move to Postgres + multiple replicas, swap the in-memory bucket for Redis or move the check into a sidecar (envoy ratelimit).

**Client IP** is read from `CF-Connecting-IP` (the Cloudflare Tunnel sets this), falling back to `X-Forwarded-For`'s first entry, then to whatever the adapter provides. See `src/lib/security/client-ip.ts`.

## Startup env validation

`src/lib/env-validate.ts` runs at module-load time of `src/lib/auth.ts`. In production builds it throws if any of the following are unset, killing the container before it can serve a single request:

- `SITE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_MAPS_API_KEY`

If you see the container CrashLoopBackOff right after a deploy and the logs say "Missing required environment variables in production", an ExternalSecret didn't sync. Check:

```bash
kubectl -n lighttheham get externalsecret
kubectl -n lighttheham describe externalsecret <name>
```

then force a resync as documented in the Secrets section above.

## Backups & disaster recovery

The SQLite database is replicated to Garage S3 every 5s by the **Litestream** sidecar. The bucket is `lighttheham-litestream`, path `db`.

### Verify backups are flowing

From any pod with mc/aws CLI configured for Garage:

```bash
mc ls garage/lighttheham-litestream/db                # should show recent files
mc stat garage/lighttheham-litestream/db/<latest>     # check timestamp
```

Also check the litestream sidecar logs:

```bash
kubectl -n lighttheham logs -f deploy/lighttheham -c litestream
# Healthy output looks like:
#   level=INFO msg="snapshot created" path=... size=...
#   level=INFO msg="wal segment uploaded" ...
```

### Restore (cold start)

This happens automatically. The `litestream-restore` init container runs on every pod start and restores the DB from S3 if it doesn't exist locally. Look for:

```
level=INFO msg="restore complete" elapsed=...
```

### Restore drill (do this at least once before the season)

1. Cordon the data PVC (or scale the deployment to 0).
2. Delete the DB file from the PVC (or wipe and recreate the PVC entirely).
3. Scale back to 1.
4. Watch the init container restore from S3.
5. Hit the site → verify properties, ratings, and user accounts are present.

Document any deviation from this in this file.

### Uploads

User-uploaded photos live on the `lighttheham-uploads` PVC (50Gi). **They are not currently backed up.** This is a known gap — Phase 1 / Phase 2 candidate. For now, treat the uploads PVC as recoverable-from-source-only (i.e., users would need to re-upload).

### Labeled snapshots (pre-deploy safety net)

Litestream's `lighttheham-litestream/db` replica is *rolling* — new WAL segments overwrite/age out old ones. That's perfect for crash recovery but useless as a "freeze this moment forever" rollback point before a risky deploy.

For that, we keep a separate bucket of named one-shot snapshots:

- **Bucket:** `garage://lighttheham-snapshots`
- **One-time setup** (run once, then never again):
  ```bash
  mc mb garage/lighttheham-snapshots
  ```

Take a snapshot before any deploy that touches the schema, the migration runner, the entrypoint, or the Litestream chain:

```bash
./scripts/snapshot-prod.sh <label>
# e.g.
./scripts/snapshot-prod.sh pre-phase1-migrations
```

This does:
1. `sqlite3 .backup` inside the running app container (consistent hot copy, no read lock).
2. `kubectl cp` the file out.
3. Verifies SQLite integrity locally.
4. `mc cp` to `garage://lighttheham-snapshots/<label>-<utc-timestamp>.db`.

Snapshots are intentionally not pruned automatically — if you take one before every risky deploy, you get a permanent forensic trail. Clean up manually once a year.

### Restoring from a labeled snapshot

Worst-case rollback (e.g., a bad migration shipped, Litestream replicated the bad state, you want to reset to a known-good moment):

1. **Take a snapshot of the current (broken) state first** so you can diff later:
   ```bash
   ./scripts/snapshot-prod.sh post-incident-broken
   ```
2. Pull the desired snapshot down:
   ```bash
   mc cp garage/lighttheham-snapshots/<label>-<timestamp>.db ./restore.db
   sqlite3 restore.db "PRAGMA integrity_check"   # verify
   ```
3. Scale the app to 0 to stop writes:
   ```bash
   kubectl -n lighttheham scale deploy/lighttheham --replicas=0
   ```
4. Copy the snapshot into the data PVC. Easiest: launch a one-shot pod that mounts the PVC and overwrite the DB:
   ```bash
   kubectl -n lighttheham debug --image=alpine --attach --rm \
     --pvcs=lighttheham-data --target-pvc-mountpath=/data -- sh
   # inside:
   #   apk add sqlite
   #   then `kubectl cp restore.db <debug-pod>:/data/lighttheham.db -c debugger`
   ```
   (or do it via a small Job manifest if you'd rather have it scripted).
5. Scale back to 1. The Litestream init container sees the restored DB file already in place and won't pull from S3 (`-if-db-not-exists` guard); the sidecar starts replicating the rolled-back state on its next sync.
6. Verify in the app, then re-snapshot under a new label so the rolled-back state is itself a known good point.

---

## Secrets

Production secrets are pulled from a `ClusterSecretStore` named `staging` via the **External Secrets Operator** and projected as `Secret` objects in the `lighttheham` namespace. Three ExternalSecrets:

| Name | Holds | Used by |
|---|---|---|
| `lighttheham-oauth` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | app container |
| `lighttheham-google-maps` | `GOOGLE_MAPS_API_KEY` | app container |
| `lighttheham-s3` | `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY` | init + sidecar |

To rotate a secret:

1. Update the value in the upstream secret store (whatever backs `staging`).
2. The External Secrets controller resyncs on its own interval; force a refresh:
   ```bash
   kubectl -n lighttheham annotate externalsecret <name> force-sync=$(date +%s) --overwrite
   ```
3. Restart the deployment so the app picks up new env vars:
   ```bash
   kubectl -n lighttheham rollout restart deploy/lighttheham
   ```

> Only Google OAuth is wired today. The schema's `users.oauthProvider` enum reserves `'apple'` and `'facebook'` for forward-compatibility, but the route handlers and provider constructors were removed in Phase 1 (no false advertising). Adding a provider later is a focused PR — see `src/lib/auth.ts` comment for the checklist.

---

## Networking

`CiliumNetworkPolicy` in `network-policy.yaml` restricts traffic to:

- **Ingress**: from the `cloudflare` namespace (the Cloudflare Tunnel pod) and the `monitoring` namespace (vmagent for `/metrics`).
- **Egress**: kube-dns, Garage S3 (`garage` namespace, port 3900), and the world on 80/443 (for Google APIs and OAuth providers).

Public traffic terminates at Cloudflare, comes through the tunnel, hits the `lighttheham` ClusterIP service, and lands on the pod. **There is no public IP.** DNS and TLS are managed in Cloudflare's UI.

(If you can't find the Cloudflare Tunnel config in the gitops repo, it lives separately — ask Casey.)

---

## On-call mental model

When something is wrong, in this order:

1. **Is the site up?** Open it. If yes, scope the issue (specific feature? specific user?).
2. **Grafana dashboard, top row.** Error rate, p95 latency, active requests. One of these will be loud.
3. **Loki panel.** Search the namespace, filter by `error`, look for stack traces.
4. **Pod state.** `kubectl -n lighttheham get pods` — running? crash-looping? `describe` for events.
5. **Litestream sidecar.** If the app is up but DB writes seem to vanish on restart, check the sidecar logs first.
6. **ArgoCD.** Did a recent sync introduce something? Roll back.

If you're unsure, **don't make destructive changes** (drop tables, delete PVCs, force-sync). Page Casey.

---

## Common chores

| Task | Command |
|---|---|
| Make a user an admin | `task admin -- their@email.com` (or `npx tsx scripts/make-admins.ts ...` in-cluster) |
| Open a DB browser locally | `task db:studio` |
| Push schema changes locally | `task db:push` (dev only — prod uses migrations) |
| Show build info | `task info` |
