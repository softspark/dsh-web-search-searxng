---
title: "Common issues"
category: troubleshooting
service: dsh-web-search-searxng
version: "1.0.0"
tags: [troubleshooting, search, provider, searxng, configuration]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "Failures with a known cause: a provider that is never selected, an instance answering HTML, and searches that reach nothing."
---

# Common issues

## The plugin loads and search still goes to DeepSeek

The provider is registered and not selected. `web.searchProvider` still names
`deepseek-official`, and a configured id that is registered always wins — no
error is raised, because nothing is wrong from the seam's point of view.

The bundle patch carries both rows. If you composed the plugin by hand, add the
second one:

```yaml
- patch:
    - id: web
      config:
        searchProvider: searxng
```

## `WEB_PROVIDER_CONFIGURED_UNAVAILABLE`

`searchProvider: searxng` is selected, the provider is registered, and
`available()` returned false. It checks one thing: that `baseURL` parses as an
absolute `http` or `https` URL.

A missing `baseURL`, a relative path, or a bare hostname without a scheme all
land here. `searxng:8080` is not a URL; `http://searxng:8080` is.

The seam deliberately does not fall back to another provider. A silent fallback
would make "which engine answered this" unanswerable.

## `did not return JSON; add "json" to search.formats`

The instance answered HTTP 200 with a rendered results page. SearXNG does not
enable JSON output by default:

```yaml
search:
  formats:
    - html
    - json
```

Restart the instance after editing `settings.yml`. Confirm from wherever the
harness runs, not from your laptop — they may reach different instances:

```bash
curl -s 'http://searxng:8080/search?q=test&format=json' | head -c 80
```

## `could not be reached`

DNS or routing, not configuration. The harness resolved nothing at that host,
or nothing accepted the connection.

In Compose, containers reach each other by service name only when they share a
network. `http://localhost:8080` inside a container means that container, not
the host — a frequent cause when the instance runs on the host and the harness
does not.

## `did not answer within N ms`

The instance is reachable and slow. Metasearch is as slow as the slowest engine
it waits for, and an instance querying many engines over a poor link exceeds a
15-second budget without being broken.

Raise `timeoutMs`, or narrow what the instance queries with `engines` or
`categories`. Raising the timeout past a minute is usually the wrong fix: the
model is waiting, and a search that slow is worth less than the turn it blocks.

## Searches return nothing at all

Empty `sources` with no error means the instance answered JSON with no results.
Reproduce it against the instance directly with the same query.

Two common causes, both in the instance rather than here: every engine for the
category is rate-limited or blocked — SearXNG's own logs say which — or
`engines`/`categories` narrowed the query to engines that returned nothing.

## The same page appears several times in the model's context

It should not: results are deduplicated by URL, first occurrence wins. Pages
that differ only by tracking parameter or trailing slash are different URLs and
survive deduplication, because normalising them would mean guessing which
parameters are meaningful.

## See also

- [Set up an instance](../howto/setup.md)
- [Architecture](../reference/architecture.md)
