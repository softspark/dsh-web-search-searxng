---
output-mode: concise
---

# dsh-web-search-searxng

## Project

`@softspark/dsh-web-search-searxng` is a strict ESM TypeScript plugin for DeepSeek Harness. It registers one `ctx.web` search provider, id `searxng`, backed by a SearXNG instance.

Version `1.0.0` is the first public release.

## Commands

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

## Architecture rules

- The module holds no credential. Never add an option that accepts an API key, token, header, or cookie — the absence of one is the reason this module exists.
- Never read the credentials service, the launch environment, or a `.env` file.
- One outbound request per search, to the configured `baseURL` only. Never follow a redirect.
- `baseURL` keeps no default. A default would send queries to a host nobody chose.
- Never put the query into an error message or a log line.
- Treat every result field as untrusted: type-guard it, omit what is missing, invent nothing.
- Let the seam enforce `maxResults`; report `truncated: false`.
- Keep `@deepseek-ai/cordis` and `@deepseek-ai/dsh-web` as peer dependencies.
- No telemetry, analytics, crash upload, or remote logging.

## TypeScript rules

- Node.js 22.19 or newer, `type: module`, and `NodeNext` resolution.
- Strict mode, no `any`, no non-null assertions in production code.
- Use `unknown` plus runtime guards at every provider boundary.
- Use `readonly` interfaces and explicit return types for exported functions.
- Use `node:` imports and `.js` extensions in relative imports.
- No lifecycle scripts, shell execution, or secrets.

## Repository rules

- The KB is the source of truth once the matching document exists.
- Behavior changes require tests and documentation in the same change.
- Conventional Commits only: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Never edit generated `lib/`.
- Never commit credentials, logs, tarballs, or SARIF output.
- Green verification gates define completion.
