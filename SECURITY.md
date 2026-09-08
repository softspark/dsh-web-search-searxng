# Security Policy

## Supported versions

The latest published `1.x` release receives security fixes on `main`. Earlier
releases must upgrade to the latest patch or minor release. See [CHANGELOG.md](CHANGELOG.md)
for the release history.

## Reporting a vulnerability

Email **biuro@softspark.eu**. Do not open a public issue.

Include the affected commit, reproduction steps, impact, and a minimal proof of concept. Remove tokens, authorization headers, search queries, prompts, workspace contents, and personal data before sending the report.

SoftSpark will acknowledge a report within 48 hours. We will coordinate validation, remediation, disclosure timing, and credit with the reporter.

## Security design

### Credentials

There are none. This plugin reads no credential, holds no key, and has nothing
to store. It must never grow configuration that accepts an API key, a token, an
authorization header, or a cookie: the absence of a credential is the reason
the module exists, and a key-shaped option would quietly undo it.

It must not read the credentials service, the launch environment, or a `.env`
file.

### Network boundary

One outbound `GET` per search, to the configured `baseURL` and nowhere else.

Redirects are refused rather than followed. A search endpoint that redirects is
a misconfiguration or an interception, and following it would send the query to
a host the operator did not configure.

`baseURL` has no default. A default would send queries to a host nobody chose,
and a public instance is a materially different privacy bargain from a local
one — that choice belongs to the operator, stated explicitly.

### Query handling

A query is user content and is treated as such. It is sent to the configured
instance and appears in no error message, so a failure can be pasted into an
issue without leaking what was searched for.

The response body is capped before parsing, and parsing is `JSON.parse` over
text — no evaluation, no code path that executes provider content.

### Result boundary

Every field of every result is untrusted input from engines the operator's
instance chose. Values are read with type guards; a field that is missing or
not a string is omitted rather than coerced, so nothing is invented on the
model's behalf. Results carry no HTML rendering and no script execution.

The seam enforces `maxResults`; this provider never over-reports `truncated`.

### Telemetry

None. The plugin must not add analytics, crash upload, or remote logging.

## Scope

In scope: credential handling that should not exist, egress to a host other
than the configured instance, query leakage through errors or logs, unsafe
handling of result content, and dependency issues with a demonstrated
exploitable path through this package.

Vulnerabilities in SearXNG, DeepSeek Harness, Cordis, Node.js, or third-party
packages should also be reported to the affected upstream project.
