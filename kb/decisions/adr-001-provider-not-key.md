---
title: "ADR-001: a search provider, not a key"
category: decisions
service: dsh-web-search-searxng
version: "1.0.0"
tags: [adr, search, credentials, privacy, provider]
created: "2026-09-08"
last_updated: "2026-09-08"
description: "Why web search in the harness is replaced at the provider seam rather than enabled by supplying the DeepSeek API key it asks for."
---

# ADR-001: a search provider, not a key

**Status:** accepted

## Context

DeepSeek Harness ships exactly one search provider. `web-search-deepseek` is a
full auxiliary model request with server-side retrieval, and it is gated on
`DEEPSEEK_API_KEY`. Without the key the provider is inert and the model's
`web_search` tool fails.

The obvious way to get search working is to supply the key. In a workbench
whose stated property is that no vendor account sits behind the agent's
ordinary actions, that is the one thing worth not doing.

A key is not only a payment detail. It is an identity: every query the agent
runs becomes attributable to one account held by one person, correlatable
across sessions and across projects, at a provider that also sees the query
text. Searching the web does not require that, and a workbench that quietly
acquires it has given something up that its documentation claims it keeps.

## Decision

Register a second search provider on the `ctx.web` seam, backed by a SearXNG
instance, and move `web.searchProvider` onto it.

SearXNG is a metasearch front end: it forwards a query to engines and merges
what they return. There is no account and no key, so there is nothing to
correlate the queries against — the property the key would have removed.

## Consequences

**The seam was built for this.** `dsh-web` resolves `searchProvider` at
execution time against a registry, and selection is explicitly not
order-dependent. Replacing the provider is a supported composition, not a
patch: nothing in the harness is modified, and the row can be removed again by
deleting two lines.

**Registration alone is not enough, and the failure is silent.** A configured
id that is registered always wins, so while `web.searchProvider` still names
`deepseek-official`, this provider loads, registers, and is never called. The
bundle therefore ships the `patch:` row alongside the `insert:` row. A
deployment that copies only the first half gets a plugin that does nothing and
no error saying so.

**The trust moves, it does not vanish.** The engines still see the query, and
so does whoever runs the instance. Pointing `baseURL` at a public SearXNG
trades a vendor you hold an account with for a stranger you do not. That is a
different bargain, not a strictly better one, and the README says so rather
than implying the problem is solved.

**One deployment dependency appears.** Search now needs an instance to be
running and reachable. This is the real cost: the DeepSeek provider needed a
key and no infrastructure, and this needs infrastructure and no key. For a
containerised workbench that already composes services, that is the cheaper
half.

**`baseURL` has no default.** A default would send queries to a host nobody
chose. The plugin loads without one and reports itself unavailable, which is
the honest outcome for "no instance was configured".

## Alternatives considered

**Supply the DeepSeek key.** Rejected: it is the property being protected, and
it also arms the provider through four credential layers, only one of which is
visible in an environment listing.

**A keyed alternative — Brave, Tavily, Exa.** Rejected as the default. They are
stable, versioned APIs and a legitimate choice, but each is still an account
and still correlates the queries; the difference from DeepSeek is whose account
it is, not whether there is one. Nothing here prevents a sibling provider
plugin for them.

**Scrape a search engine directly.** Rejected. No key and no account, and it
breaks whenever the target changes its markup — silently, and in a way that
reads as a defect in this module rather than a change at the target. It is also
squarely against those engines' terms.
