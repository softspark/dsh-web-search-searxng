/**
 * A `ctx.web` search provider backed by a SearXNG instance.
 *
 * SearXNG is a metasearch front end: it forwards a query to engines it is
 * configured for and returns their results merged. That is the whole reason
 * this provider exists — the search leaves under the instance's identity, not
 * under an account of yours, and no vendor issues a key that ties the queries
 * together.
 *
 * @module @softspark/dsh-web-search-searxng/provider
 */
import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'

/** Stable id this provider registers under. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/**
 * Options for one search, snapshotted per operation so a settings change
 * between two searches never lands halfway through one.
 */
export interface SearxngOptions {
  readonly baseURL: string
  readonly timeoutMs: number
  readonly language?: string
  readonly safeSearch: 0 | 1 | 2
  readonly categories?: string
  readonly engines?: string
}

/** Cap on the decoded response body, before parsing. */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024

/**
 * The shape this provider reads out of SearXNG's JSON. Everything is optional
 * because an instance's engines decide what is present, and a missing field
 * must degrade to an omitted one rather than an invented value.
 */
interface SearxngPayload {
  readonly results?: readonly {
    readonly url?: unknown
    readonly title?: unknown
    readonly content?: unknown
    readonly publishedDate?: unknown
  }[]
  readonly answers?: readonly unknown[]
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * SearXNG has returned `answers` as bare strings and, since 2024, as objects
 * carrying an `answer` field. Reading both keeps this provider working across
 * instance versions the operator controls and we do not.
 */
function answerText(value: unknown): string | undefined {
  if (typeof value === 'string') return asText(value)
  if (typeof value === 'object' && value !== null && 'answer' in value) {
    return asText((value as { readonly answer?: unknown }).answer)
  }
  return undefined
}

/** Build the query URL. `format=json` is what the instance must be configured to allow. */
export function searchUrl(options: SearxngOptions, request: WebSearchRequest): URL {
  const url = new URL('search', `${options.baseURL.replace(/\/+$/, '')}/`)
  url.searchParams.set('q', request.query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('safesearch', String(options.safeSearch))
  if (options.language !== undefined) url.searchParams.set('language', options.language)
  if (options.categories !== undefined) url.searchParams.set('categories', options.categories)
  if (options.engines !== undefined) url.searchParams.set('engines', options.engines)
  return url
}

/**
 * Map one SearXNG payload to the seam's vocabulary. Sources without a usable
 * URL are dropped rather than emitted with an empty one, and duplicates are
 * removed: metasearch merges engines, and the same page arrives from several.
 *
 * The seam owns the final `maxResults` truncation, so `truncated` is always
 * false here.
 */
export function mapPayload(payload: SearxngPayload): WebSearchResult {
  const seen = new Set<string>()
  const sources: WebSearchSource[] = []
  for (const result of payload.results ?? []) {
    const url = asText(result.url)
    if (url === undefined || seen.has(url)) continue
    seen.add(url)
    const title = asText(result.title)
    const snippet = asText(result.content)
    const publishedAt = asText(result.publishedDate)
    sources.push({
      url,
      ...(title === undefined ? {} : { title }),
      ...(snippet === undefined ? {} : { snippet }),
      ...(publishedAt === undefined ? {} : { publishedAt }),
    })
  }
  const answer = (payload.answers ?? []).map(answerText).find((text) => text !== undefined)
  return {
    ...(answer === undefined ? {} : { content: answer }),
    sources,
    truncated: false,
  }
}

/**
 * The SearXNG-backed search provider.
 *
 * Failures are deliberately specific. An instance that answers HTML where JSON
 * was asked for is the single most common misconfiguration — `search.formats`
 * omits `json` by default — and it must not read as "no results".
 */
export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  constructor(private readonly resolveOptions: () => SearxngOptions) {}

  /** Usable when an absolute HTTP(S) base URL is configured. No network here. */
  available(): boolean {
    try {
      const { protocol } = new URL(this.resolveOptions().baseURL)
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    const options = this.resolveOptions()
    const url = searchUrl(options, request)
    const timeout = AbortSignal.timeout(options.timeoutMs)
    const composite = signal === undefined ? timeout : AbortSignal.any([signal, timeout])

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: composite,
      })
    } catch (cause) {
      if (signal?.aborted === true) {
        throw new WebError('SearXNG search was cancelled', 'WEB_CANCELLED', { cause })
      }
      if (timeout.aborted) {
        throw new WebError(
          `SearXNG did not answer within ${options.timeoutMs} ms at ${url.origin}`,
          'WEB_PROVIDER_TIMEOUT',
          { cause },
        )
      }
      throw new WebError(
        `SearXNG at ${url.origin} could not be reached`,
        'WEB_PROVIDER_ERROR',
        { cause },
      )
    }

    if (!response.ok) {
      throw new WebError(
        `SearXNG at ${url.origin} answered ${String(response.status)}`,
        'WEB_PROVIDER_ERROR',
      )
    }

    const body = await response.text()
    if (body.length > MAX_RESPONSE_BYTES) {
      throw new WebError(
        `SearXNG returned more than ${String(MAX_RESPONSE_BYTES)} bytes`,
        'WEB_PROVIDER_ERROR',
      )
    }

    let payload: SearxngPayload
    try {
      payload = JSON.parse(body) as SearxngPayload
    } catch (cause) {
      // Worth naming precisely: an instance whose `search.formats` omits `json`
      // answers the same URL with a rendered results page and HTTP 200.
      throw new WebError(
        `SearXNG at ${url.origin} did not return JSON; add "json" to search.formats in its settings.yml`,
        'WEB_PROVIDER_ERROR',
        { cause },
      )
    }
    return mapPayload(payload)
  }
}
