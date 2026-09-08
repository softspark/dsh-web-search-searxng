---
title: "SOP: Post-Release Testing"
category: procedures
service: dsh-web-search-searxng
version: "1.0.0"
tags: [sop, post-release, smoke-test, provenance, dsh, searxng]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "Verify the published package from the npm registry in an isolated DSH profile, including the provenance attestation and a real search."
---

# SOP: Post-Release Testing

Run this against the **published** package, never the working tree. The point
is to catch what only the registry round-trip can break: a file missing from
`files`, an attestation that was signed but not accepted, a bundle patch that
does not compose.

## 1. The artefact and its attestation

```bash
npm view @softspark/dsh-web-search-searxng@X.Y.Z
npm audit signatures --package @softspark/dsh-web-search-searxng
```

- [ ] The version is present with the expected `dist.tarball`
- [ ] Provenance is attested, not merely claimed by the workflow

An attestation that verification rejects is a failed release even when the
publish reported success — see [SOP: Release](sop-release.md).

## 2. The tarball carries what it must

```bash
npm pack @softspark/dsh-web-search-searxng@X.Y.Z
tar -tzf softspark-dsh-web-search-searxng-X.Y.Z.tgz
```

- [ ] `package/lib/**` — compiled output with `.d.ts`
- [ ] `package/cordis.patch.yml` — without it the bundle registers nothing
- [ ] `package/LICENSE` and `package/NOTICE` — §4(d) is an obligation, not a courtesy
- [ ] No `src/`, `tests/`, or `.github/`

## 3. It composes in a throwaway profile

```bash
export DSH_HOME=$(mktemp -d)
dsh plugin --profile smoke add @softspark/dsh-web-search-searxng@X.Y.Z
grep -A3 'id: web$' "$DSH_HOME/profiles/smoke/cordis.yml"
```

- [ ] The `web-search-searxng` row is present
- [ ] `web.searchProvider` reads `searxng`

The second line is the one worth checking. The `insert:` row alone leaves a
provider that is registered and never selected, and nothing reports that as an
error.

## 4. A real search returns real sources

Point it at an instance and ask the model to search for something whose answer
carries a date, so a cached or invented reply is obvious.

- [ ] Sources come back with URLs from more than one engine
- [ ] The same URL does not appear twice
- [ ] Stopping the turn cancels the search rather than leaving it running

Then confirm the failure paths are still specific, because they are what a user
meets on a bad day:

```bash
curl -s "$SEARXNG/search?q=test&format=json" | head -c 40
```

- [ ] An HTML answer produces the error naming `search.formats`, not "no results"
- [ ] An unreachable `baseURL` produces `could not be reached`
- [ ] No error message contains the query

## 5. Clean up

Delete the temporary `DSH_HOME` the run created and the packed tarball. Both
are throwaway paths this procedure made; your real profile is elsewhere and
must be left alone.

- [ ] The throwaway profile is gone
- [ ] Your real profile is untouched

## If something failed

Published versions are immutable and old versions stay. Do not unpublish — a
consumer who pinned it deserves better than a 404. Fix forward with a patch
release and record what failed in that release's changelog entry. A release
whose smoke test failed silently is the reason the next one is not trusted.

## See also

- [SOP: Release](sop-release.md)
- [Common issues](../troubleshooting/common-issues.md)
