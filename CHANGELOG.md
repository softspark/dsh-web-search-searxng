# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-08

First public release.

### Added

- A `ctx.web` search provider, id `searxng`, backed by a SearXNG instance. No API key and no vendor account: the harness ships one search provider and it is gated on `DEEPSEEK_API_KEY`, which is an identity as much as a payment detail.
- A bundle patch that both registers the provider and moves `web.searchProvider` onto it. Registering alone changes nothing — the seam resolves the configured id at call time and a registered configured id always wins.
- Result mapping that deduplicates by URL, since metasearch merges engines and the same page arrives more than once, and that omits optional fields rather than inventing them.
- A named error for the JSON format the instance does not enable by default. Without `json` in `search.formats`, SearXNG answers the same URL with a results page and HTTP 200, which would otherwise read as "no results".
- Distinct errors for an unreachable instance, a non-2xx answer, a timeout, and a caller cancellation. None of them carries the query.
