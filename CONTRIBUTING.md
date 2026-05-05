# Contributing to Light the Ham

If this is your first time touching the project, read [`docs/STACK.md`](docs/STACK.md) before this file. It explains every framework / service we use in one line each.

This document covers **how we work together** — the dev loop, the git flow, the PR conventions. The goal is that the rails do the teaching: if you follow this, you'll inherit the project's habits without anyone having to nag you.

---

## 1. Set up your environment

You need:

- **Node.js 20+** (use `nvm` or `volta` if you juggle versions).
- **pnpm** (install: `corepack enable && corepack prepare pnpm@latest --activate`).
- **Task** (install: `brew install go-task` or follow [taskfile.dev/installation](https://taskfile.dev/installation)).
- **Google Cloud OAuth + Maps API keys** for local dev (see `.env.example`).

Then:

```bash
pnpm install
cp .env.example .env          # fill in your credentials
pnpm db:push                  # create local SQLite tables (dev convenience)
pnpm db:seed                  # seed sample data
task dev                      # http://localhost:4321
```

For mobile testing (e.g., the map on a phone): `task dev:host` exposes the dev server on your LAN.

---

## 2. The dev loop

```
task dev          # start the dev server (hot reload)
# … make a change …
# … see it at http://localhost:4321 …
task fmt          # auto-format with Biome
task lint         # lint with Biome (CI runs this)
task typecheck    # tsc --noEmit (CI runs this)
task test         # run Vitest (CI runs this)
task build        # production build (CI runs this)
```

CI runs `lint → typecheck → test → build` on every PR. Run them locally before pushing — it's faster than waiting for CI to fail.

---

## 3. Git flow

We use a simple **trunk-based** flow with feature branches. No long-lived dev/staging branches. The deployed version of the site is always `main`.

### Branch naming

| Prefix | When to use | Example |
|---|---|---|
| `feat/`  | New user-facing functionality | `feat/season-countdown` |
| `fix/`   | Bug fix that doesn't change behavior intentionally | `fix/tip-duplicate-check` |
| `chore/` | Tooling, deps, refactors with no behavior change | `chore/bump-astro-5.17` |
| `docs/`  | Docs-only changes | `docs/runbook-rollback` |
| `infra/` | Things that touch the Dockerfile, entrypoint, or coordinate with `../phillips-homelab/` | `infra/drizzle-migrate` |

Keep branch names short. One issue → one branch → one PR.

### Commit messages

Use **conventional commits**:

```
<type>(<optional scope>): <subject in imperative mood, no period>

<optional body — what changed and why, wrapped at ~72 cols>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`, `ci`. Examples:

- `fix(api): use isNotNull for tip duplicate check`
- `feat(map): cluster markers above zoom 12`
- `docs: explain Litestream restore flow in RUNBOOK`

The PR title should follow the same format — that's what becomes the squash-merge commit message.

### Working in your branch

Make your branch from the latest `main`:

```bash
git switch main
git pull
git switch -c feat/your-thing
```

While working, **rebase** onto `main` if main has moved. We prefer rebase over merge for keeping branch history linear:

```bash
git fetch origin
git rebase origin/main
```

If you have already pushed your branch and rebased, you'll need a force-push — but **only** to your own feature branch:

```bash
git push --force-with-lease       # safer than --force
```

**Never force-push to `main`.** Branch protection should prevent it; treat it as a hard rule regardless.

---

## 4. Pull requests

### Before opening

- [ ] Branch is up to date with `main` (`git rebase origin/main`).
- [ ] `task fmt && task lint && task typecheck && task test` all pass locally.
- [ ] If you added a new framework or pattern, mention it in the PR description.
- [ ] If your change touches the schema, confirm a migration was generated (`pnpm db:generate`).
- [ ] If your change touches deploy shape (Dockerfile, env, ports), open a coordinated PR in `../phillips-homelab/`.

### PR description

Use the template (it auto-fills when you open a PR). Cover:

1. **What** changed at a behavior level.
2. **Why** — link the issue, explain the motivation.
3. **How to verify** — commands, URLs, screenshots.
4. **Risks / follow-ups** — anything you cut for scope, anything you're unsure about.

### Review

- All PRs require **at least one approval** before merging.
- CI must be green.
- We **squash-merge** — your N branch commits become 1 commit on `main`. Make sure the PR title is the commit message you want.

---

## 5. Issues & project tracking

We track work in **GitHub Issues** with a Projects board (Kanban: `Backlog` / `In Progress` / `In Review` / `Done`).

- Every PR should reference an issue: include `Closes #123` in the PR body so the issue auto-closes on merge.
- File a good bug report: steps to reproduce, expected vs. actual, environment (browser, mobile/desktop, logged-in or not).
- For features, write the issue from the user's perspective ("Visitor can sort the map by rating"), not the implementation's.

The seed backlog is the [2026 spring-cleaning plan](#) — work through it in roughly the order proposed.

---

## 6. Testing

We use **Vitest**. Tests live next to the code (`foo.ts` → `foo.test.ts`) — *except* for tests of files under `src/pages/`. Astro treats every `.ts` under `src/pages/` as a page or API route, so a colocated `.test.ts` there will be picked up by the build and crash it. For those, put the test under `tests/` mirroring the source path (e.g. `src/pages/api/tips/submit.ts` → `tests/api/tips/submit.test.ts`).

What deserves a test:

- **Bug fixes** — write the failing test first (the one that proves the bug), then fix.
- **API handlers** — at minimum, the auth/validation/happy-path matrix.
- **Pure utility functions** — anything in `src/lib/` that doesn't hit I/O.

What we *don't* exhaustively test (yet):

- Astro components (manual / visual review for now).
- Database queries (covered by the API handler tests that use them).

Run a single file: `pnpm vitest run path/to/file.test.ts`.

---

## 7. Security mindset

Read [`CLAUDE.md`](CLAUDE.md) (the section "Things to never break") before touching:

- `src/lib/auth.ts` (cookies, sessions, OAuth)
- `src/middleware.ts` (rate-limit, CSRF, request-id will live here)
- Any `src/pages/api/**` handler that takes user input

When you add a new mutation endpoint, ask:

1. Does it require auth? Admin role?
2. What input does it accept, and is it validated?
3. Could this be spammed? Rate-limited?
4. Does it read or write a file path? Path-traversal safe?
5. Does it accept an upload? Size limit, MIME check, *and* magic-byte check?

If the answer to any of these is "I'm not sure," ask before merging.

---

## 8. When you're stuck

- **Stack question** ("what is Drizzle, again?") → `docs/STACK.md`.
- **"How do I deploy / roll back / find the logs?"** → `docs/RUNBOOK.md`.
- **"What should an AI session know about this repo?"** → `CLAUDE.md`.
- **"Is this approach OK?"** → open a draft PR early and ask in the description; cheaper than discovering it in review.
