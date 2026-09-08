# dsh-web-search-searxng

> A web-search provider for the DeepSeek Harness, backed by a [SearXNG](https://docs.searxng.org/) instance. No API key, no vendor account, and nothing for this plugin to store.

[![npm](https://img.shields.io/npm/v/@softspark/dsh-web-search-searxng.svg)](https://www.npmjs.com/package/@softspark/dsh-web-search-searxng)
[![CI](https://github.com/softspark/dsh-web-search-searxng/actions/workflows/ci.yml/badge.svg)](https://github.com/softspark/dsh-web-search-searxng/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![DSH community plugin](https://img.shields.io/badge/DSH-community%20plugin-4b8bbe.svg)](https://github.com/topics/dsh-plugin)

The harness ships one search provider and it is gated on `DEEPSEEK_API_KEY`. This registers a second one on the same seam and moves the selection onto it.

```bash
dsh plugin add @softspark/dsh-web-search-searxng
```

Then tell it where the instance is:

```yaml
- id: web-search-searxng
  name: '@softspark/dsh-web-search-searxng'
  config:
    baseURL: http://searxng:8080
```

This is an independently maintained SoftSpark integration. It is unofficial and is not affiliated with or endorsed by DeepSeek or the SearXNG project.

---

## What's new in 1.0.0

First public release.

- One `ctx.web` search provider, id `searxng`, and the bundle patch that actually selects it — registering alone changes nothing, and nothing reports that as an error.
- Results deduplicated by URL, because metasearch merges engines and the same page arrives more than once.
- Optional fields omitted rather than invented; `dsh-tool-web` already renders `title ?? hostname(url)`.
- A named error for the JSON format SearXNG does not enable by default, so an instance answering HTML with HTTP 200 does not read as "no results".
- No credential path at all, no redirects followed, and no error that carries the query.

Full history in [CHANGELOG.md](CHANGELOG.md).

---

## Why this exists

The harness ships one search provider, `web-search-deepseek`, and it is gated on `DEEPSEEK_API_KEY`. That is a sensible default and a poor fit for a workbench whose point is that no vendor account sits behind the agent's ordinary actions. The key is not just a payment detail: it is an identity, and it makes every query the agent runs attributable to one account held by one person.

Searching the web does not need that. A metasearch front end forwards the query to engines and returns what they say, and the account it does not have is the account nobody can correlate against.

**What this does not claim.** The engines still see the query, and so does whoever runs the instance. Pointing `baseURL` at a public SearXNG moves the trust from a vendor you have an account with to a stranger you do not — which is a different bargain, not a strictly better one. Run your own instance if the queries matter.

---

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `baseURL` | **required** | Absolute URL of the instance, without `/search`. No default: a guess would send queries somewhere you did not choose. |
| `timeoutMs` | `15000` | Upper bound on one search. Between 1000 and 120000. |
| `language` | unset | UI language passed through, e.g. `pl` or `en-US`. |
| `safeSearch` | `0` | SearXNG safe-search level: 0 off, 1 moderate, 2 strict. |
| `categories` | unset | Comma-separated categories, e.g. `general,it`. |
| `engines` | unset | Comma-separated engine names, narrowing what the instance queries. |

Unset optional keys are omitted from the request rather than sent empty, so the instance's own defaults apply.

### The instance must be allowed to answer in JSON

SearXNG does not enable the JSON output format by default. Without it, the instance answers the same URL with a rendered results page and HTTP 200 — which would read as "no results" if this provider did not check. Add it to the instance's `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

The provider names this fix in the error when it sees HTML, so the failure is one you can act on rather than one you have to guess at.

---

## What the bundle does to the harness

Two rows, and both are needed:

```yaml
- insert:
    - id: web-search-searxng
      name: '@softspark/dsh-web-search-searxng'

- patch:
    - id: web
      config:
        searchProvider: searxng
```

Registering the provider alone changes nothing. The `web` seam resolves `searchProvider` at call time, and a configured id that is registered always wins — so while `web.searchProvider` still names `deepseek-official`, this provider is registered and never selected. The `patch:` row is what moves the selection.

Leaving the DeepSeek row mounted is otherwise harmless: without a key it reports itself unavailable. Removing it is still worth doing where the point is that no key path exists at all.

---

## Behaviour

**Selection is not order-dependent.** The seam resolves the configured id at execution time. An id that is registered but unavailable fails as `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` rather than silently falling back to another provider — a fallback would make "which engine answered this" unanswerable.

**`available()` makes no network call.** It reports whether an absolute `http(s)` base URL is configured. Whether the instance is reachable is a question for the search itself, and answering it in a usability check would make every provider listing a round trip.

**Results are deduplicated by URL.** Metasearch merges engines and the same page arrives more than once; the first occurrence wins, so the engine ordering the instance chose is preserved.

**Optional fields are omitted, not invented.** A result with no title returns no title. `dsh-tool-web` renders `title ?? hostname(url)` and is built for this.

**Redirects are refused.** A search URL that redirects is a misconfiguration or an interception, not a route to follow.

**Errors name what to do.** An unreachable instance, a non-2xx answer, a timeout, and an HTML answer are four distinct messages. None of them contains the query — an error is a place a search term should never leak into.

---

## Security

This plugin reads no credential and holds no key. It makes one outbound `GET` per search, to the `baseURL` you configured and nowhere else.

Report vulnerabilities per [SECURITY.md](SECURITY.md).

---

## Documentation

- [Set up an instance](kb/howto/setup.md)
- [Architecture](kb/reference/architecture.md)
- [ADR-001: a search provider instead of a key](kb/decisions/adr-001-provider-not-key.md)
- [Common issues](kb/troubleshooting/common-issues.md)

## Licence

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
