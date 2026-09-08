/**
 * Register a SearXNG-backed search provider on the DeepSeek Harness web seam.
 *
 * The harness ships one search provider, and it is gated on a DeepSeek API key.
 * That is a reasonable default and a poor fit for a workbench whose point is
 * that no vendor account sits behind the agent's ordinary actions: the key ties
 * every query to an account, and there is no version of "search the web" that
 * needs one. This plugin points the same seam at a SearXNG instance instead.
 *
 * It reads no credential, holds no key, and has nothing to store. What it needs
 * is a base URL, which is a deployment decision the operator makes once.
 *
 * @module @softspark/dsh-web-search-searxng
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import {
  SEARXNG_PROVIDER_ID,
  SearxngSearchProvider,
  type SearxngOptions,
} from './provider.js'

export { SEARXNG_PROVIDER_ID, SearxngSearchProvider } from './provider.js'
export { mapPayload, searchUrl, type SearxngOptions } from './provider.js'

export const name = 'dsh-web-search-searxng'
export const inject = ['web']

/** A search is an interactive wait, not a batch job. */
const DEFAULT_TIMEOUT_MS = 15_000
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 120_000

export interface Config {
  /**
   * Absolute base URL of the SearXNG instance, without a trailing `/search`.
   * There is no default: a wrong guess would send queries somewhere the
   * operator did not choose, and a public instance is a different privacy
   * bargain from a local one.
   */
  readonly baseURL: string
  readonly timeoutMs?: number
  /** UI language code passed to the instance, e.g. `pl` or `en-US`. */
  readonly language?: string
  /** SearXNG safe-search level: 0 off, 1 moderate, 2 strict. */
  readonly safeSearch?: 0 | 1 | 2
  /** Comma-separated SearXNG categories, e.g. `general,it`. */
  readonly categories?: string
  /** Comma-separated engine names, narrowing what the instance queries. */
  readonly engines?: string
}

export const Config: z<Config> = z.object({
  baseURL: z.string(),
  timeoutMs: z.number().min(MIN_TIMEOUT_MS).max(MAX_TIMEOUT_MS).default(DEFAULT_TIMEOUT_MS),
  language: z.string(),
  safeSearch: z.union([z.const(0), z.const(1), z.const(2)]).default(0),
  categories: z.string(),
  engines: z.string(),
})

export function apply(ctx: Context, config: Config): void {
  // Snapshotted per operation rather than captured once: the plugin can be
  // reconfigured while the harness runs, and a search that started before a
  // change must not finish under half of the new settings.
  const resolveOptions = (): SearxngOptions => ({
    baseURL: config.baseURL,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    ...(config.language === undefined ? {} : { language: config.language }),
    safeSearch: config.safeSearch ?? 0,
    ...(config.categories === undefined ? {} : { categories: config.categories }),
    ...(config.engines === undefined ? {} : { engines: config.engines }),
  })

  ctx.effect(
    () => ctx.web.registerSearchProvider(new SearxngSearchProvider(resolveOptions)),
    `${name}: register the "${SEARXNG_PROVIDER_ID}" search provider`,
  )
}
