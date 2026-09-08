---
title: "Architecture"
category: reference
service: dsh-web-search-searxng
version: "1.0.0"
tags: [architecture, provider, web-seam, cordis, searxng]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "What this plugin registers, how the harness picks it, and where each boundary sits."
---

# Architecture

One plugin, one provider, one outbound request per search. Everything below was
read out of the shipped `@deepseek-ai/dsh-web` code, not out of its docs.

## The seam

`ctx.web` is a Cordis service owning two registries — search providers and
fetch providers — plus the execution that selects between them.

```text
model → dsh-tool-web → ctx.web.search(request, signal)
                            │
                            ├─ resolve searchProvider by id
                            └─ provider.search(request, signal)
                                    │
                                    └─ GET {baseURL}/search?format=json
```

`dsh-tool-web` owns the `web_search` tool the model sees and sets
`maxResults`. The seam enforces that bound on the way back and sets
`truncated` if it had to cut. A provider that also honours it at the request
layer is doing a cost optimisation, not a correctness one — this provider
leaves the bound to the seam, because SearXNG's own result count is a function
of which engines answered.

## Selection

Resolved at execution time, never at registration time:

| Situation | Outcome |
|---|---|
| Configured id registered and `available()` | that provider |
| Configured id not registered | `WEB_PROVIDER_CONFIGURED_MISSING` |
| Configured id registered, unavailable | `WEB_PROVIDER_CONFIGURED_UNAVAILABLE` |
| No id, exactly one usable provider | that provider |
| No id, several usable | `WEB_PROVIDER_AMBIGUOUS` |
| No id, none usable | `WEB_PROVIDER_UNAVAILABLE` |

Two consequences worth stating. A configured provider that is unavailable
**fails**; it does not fall back to another registered one, which is what keeps
"which engine answered this" an answerable question. And registering a second
provider without moving `searchProvider` changes nothing at all — see
[ADR-001](../decisions/adr-001-provider-not-key.md).

## The provider

```ts
interface WebSearchProvider {
  readonly id: string
  available(): boolean                                  // cheap, no network
  search(request, signal?): Promise<WebSearchResult>
}
```

`available()` reports whether an absolute `http(s)` `baseURL` is configured.
Reachability is deliberately not checked here: the contract says no network
call, and a usability probe that opens a socket turns every provider listing
into a round trip.

`search()` issues one `GET`. `redirect: 'error'` — a search endpoint that
redirects is a misconfiguration or an interception, and following it would send
the query to a host the operator never configured. The abort signal from the
caller is composed with a timeout, so the two cancellation causes stay
distinguishable in the error.

## Mapping

SearXNG returns `results[]` from every engine it queried, merged. The mapping
is deliberately lossy in one direction only:

- Results without a usable `url` are dropped rather than emitted with an empty
  one.
- Duplicates are removed by URL, first occurrence wins, preserving the ordering
  the instance produced. Metasearch surfaces the same page from several
  engines; without this the model sees the same source three times.
- `title`, `content` → `snippet`, and `publishedDate` → `publishedAt` are
  carried when non-empty and **omitted otherwise**. Inventing them would make
  the seam lie; `dsh-tool-web` already renders `title ?? hostname(url)`.
- `answers[]` becomes `content` when present. SearXNG has returned these as
  bare strings and, more recently, as objects with an `answer` field; both are
  read, because the instance version is the operator's to choose.

`truncated` is always `false` from here. The seam owns it.

## Configuration lifetime

Options are snapshotted per operation rather than captured once at
registration. The plugin can be reconfigured while the harness runs, and a
search that started before a change must not finish under half of the new
settings.

## Boundaries

| Boundary | Rule |
|---|---|
| Credentials | none exist; the module must never gain an option that accepts one |
| Egress | one `GET` per search, to `baseURL` only, no redirects |
| Query | user content; sent to the instance, never placed in an error or a log |
| Response | capped before parsing; `JSON.parse` over text, nothing evaluated |
| Result fields | untrusted; type-guarded, omitted when absent, never coerced |

## See also

- [ADR-001: a search provider, not a key](../decisions/adr-001-provider-not-key.md)
- [Set up an instance](../howto/setup.md)
- [Common issues](../troubleshooting/common-issues.md)
