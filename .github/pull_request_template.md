## What changed

<!-- One or two sentences. What does this PR do at a behavior level? -->

## Why

<!-- Link the issue: "Closes #123" so it auto-closes on merge.
     Briefly state the motivation. -->

Closes #

## How to verify

<!-- Commands, URLs, screenshots. Help your reviewer reproduce.
     Example:
     1. `task dev`
     2. Visit /map
     3. Click a marker — confirm tooltip shows the new field. -->

## Risks / follow-ups

<!-- Anything you cut for scope, anything you're unsure about,
     anything that needs a coordinated change in ../phillips-homelab/. -->

## Checklist

- [ ] `task fmt && task lint && task typecheck && task test` pass locally
- [ ] Branch is rebased on latest `main`
- [ ] Schema changes have a generated migration (`pnpm db:generate`) committed
- [ ] If this changes deploy shape (Dockerfile, env, ports), a coordinated PR exists in `../phillips-homelab/`
- [ ] If this adds a new mutation endpoint, security checklist in `CONTRIBUTING.md` §7 was reviewed
