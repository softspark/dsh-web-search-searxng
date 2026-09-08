---
title: "SOP: Release"
category: procedures
service: dsh-web-search-searxng
version: "1.0.0"
tags: [sop, release, npm, provenance]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "Prepare and publish a provenance-enabled dsh-web-search-searxng release."
---

# SOP: Release

## Prerequisites

- [ ] [Pre-commit gate](sop-pre-commit.md) passed on the commit being released
- [ ] The GitHub repository is **public**
- [ ] `NPM_TOKEN` exists as a repository secret, with publish rights on `@softspark`

The visibility requirement is not cosmetic. npm provenance has three
preconditions — `--access public`, `id-token: write`, and a public source
repository — and a private repo fails at verification with `422 Unprocessable
Entity` *after* npm has signed the statement and written it to the transparency
log. The signature exists and the publish does not.

## Prepare

1. Set the new version consistently:

```bash
npm version <major|minor|patch> --no-git-tag-version
npm run verify:version
```

2. Add the `CHANGELOG.md` entry under a dated heading. Say what changed and why
   it mattered, not which files moved.

3. Update `README.md`, `llms.txt`, and any KB document the change contradicts.
   A stale count or a stale claim is a defect, fixed in this release rather than
   after it.

4. Commit with a Conventional Commit subject, then:

```bash
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main
git push origin vX.Y.Z
```

The tag is what publishes. `.github/workflows/publish.yml` re-runs the whole
gate before it uploads anything, so a tag on a broken commit fails loudly
rather than shipping.

## Verify the publish

```bash
gh run watch --exit-status
npm view @softspark/dsh-web-search-searxng version
```

- [ ] The workflow succeeded
- [ ] The registry reports the new version
- [ ] The GitHub release exists

Then run [SOP: Post-Release Testing](sop-post-release-testing.md). A release
nobody verified from the registry is a release nobody has tested.

## If the publish failed after signing

Do not retag. Fix forward with a patch release: the version number is spent,
and a moved tag makes the transparency log disagree with the repository.

## See also

- [SOP: Pre-Commit Quality Gate](sop-pre-commit.md)
- [SOP: Post-Release Testing](sop-post-release-testing.md)
