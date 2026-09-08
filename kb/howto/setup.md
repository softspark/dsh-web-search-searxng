---
title: "Set up an instance"
category: howto
service: dsh-web-search-searxng
version: "1.0.0"
tags: [setup, searxng, docker, compose, configuration]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "Run a SearXNG instance the harness can reach, enable the JSON format it needs, and point the plugin at it."
---

# Set up an instance

Two steps that matter and one that catches everyone: run the instance, allow
JSON, point the plugin at it.

## 1. Run SearXNG

Any reachable instance works. The smallest useful one is a container beside the
harness:

```yaml
services:
  searxng:
    image: searxng/searxng:2026.8.29-fc4a1cbb2
    environment:
      SEARXNG_BASE_URL: http://searxng:8080/
    volumes:
      - ./searxng:/etc/searxng:rw
    # No published port: only the harness needs to reach it, and a search
    # front end on a host interface is an open relay for whoever finds it.
```

Pin the image. A metasearch front end tracks engine changes, so it releases
often, and "latest" means the parser your provider talks to can change under a
restart.

## 2. Allow the JSON format

**This is the step that catches people.** SearXNG does not enable JSON output
by default. Without it the instance answers the same URL with a rendered
results page and HTTP 200, which would read as "no results" from anything less
careful.

In `settings.yml`:

```yaml
search:
  formats:
    - html
    - json
```

The provider names this fix in the error when it sees HTML, so you get told
rather than left guessing.

## 3. Point the plugin at it

```bash
dsh plugin add @softspark/dsh-web-search-searxng
```

```yaml
- id: web-search-searxng
  name: '@softspark/dsh-web-search-searxng'
  config:
    baseURL: http://searxng:8080
    language: pl
    timeoutMs: 15000
```

`baseURL` is required and has no default. It is the URL of the instance, not of
its `/search` endpoint.

The bundle also carries a `patch:` row moving `web.searchProvider` to `searxng`.
Without it the provider registers and is never selected — see
[ADR-001](../decisions/adr-001-provider-not-key.md).

## 4. Check it

Ask the model to search for something with a date in the answer, so a cached
reply is obvious. Or check the instance directly from wherever the harness
runs:

```bash
curl -s 'http://searxng:8080/search?q=deepseek+harness&format=json' | head -c 200
```

JSON starting with `{"query"` means both steps landed. An HTML document means
step 2 did not.

## What to decide before you point it anywhere

Running your own instance is the configuration this module was written for. A
public instance also works, and it moves the trust rather than removing it:
whoever runs it sees every query. Pick deliberately.

## See also

- [Architecture](../reference/architecture.md)
- [Common issues](../troubleshooting/common-issues.md)
