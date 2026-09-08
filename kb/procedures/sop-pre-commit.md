---
title: "SOP: Pre-Commit Quality Gate"
category: procedures
service: dsh-web-search-searxng
version: "1.0.0"
tags: [sop, pre-commit, quality-gate, tests]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "The blocking local gate before every commit."
---

# SOP: Pre-Commit Quality Gate

## Purpose

Nothing is committed that a reviewer would have to run the gate themselves to
trust. Every command below must pass, in order, with no flags that skip it.

## The gate

```bash
npm ci --ignore-scripts
npm run verify
npm run typecheck
npm run lint
npm run test:coverage
npm run build
npm run audit
npm run audit:dependencies
npm run audit:signatures
npm run package:check
```

- [ ] Every command exits zero
- [ ] Coverage did not fall below the configured threshold
- [ ] `npm run package:check` lists `lib/`, `cordis.patch.yml`, `README.md`, `CHANGELOG.md`, `LICENSE`, `NOTICE` and nothing else

## Show the change

```bash
git diff
git status --short
```

Paste the diff into the report, or state precisely why it is too large and
summarise it by file with counts. A task that reports success without showing
the change asks the reader to take the result on trust, and the reader is the
one who has to decide whether to ship it.

## Before committing

- [ ] Behaviour changes carry tests **and** documentation in the same commit
- [ ] `README.md`, `CHANGELOG.md`, `llms.txt` and the KB agree with each other
- [ ] Conventional Commit subject: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- [ ] No `--no-verify`, no `--no-gpg-sign`. A failing hook is a cause to fix, not a flag to pass

## Running the tests when the host bindings are wrong

`vitest` loads a native `rolldown` binding matched to the platform that
installed `node_modules`. A tree installed inside a Linux container and read
from macOS — or the reverse — fails at startup with `Cannot find native
binding`, which is an install artefact and not a defect in the change.

Reinstall on the platform you intend to run on, or run the suite where the
tree was built.

## See also

- [SOP: Release](sop-release.md)
