import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  SEARXNG_PROVIDER_ID,
  SearxngSearchProvider,
  mapPayload,
  searchUrl,
  type SearxngOptions,
} from '../src/provider.js'

const OPTIONS: SearxngOptions = {
  baseURL: 'http://searxng:8080',
  timeoutMs: 5_000,
  safeSearch: 0,
}

function provider(overrides: Partial<SearxngOptions> = {}): SearxngSearchProvider {
  return new SearxngSearchProvider(() => ({ ...OPTIONS, ...overrides }))
}

function respondWith(body: string, init: ResponseInit = {}): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200, ...init })))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchUrl', () => {
  it('asks for JSON and carries the tuning options', () => {
    const url = searchUrl(
      { ...OPTIONS, language: 'pl', safeSearch: 2, categories: 'general,it', engines: 'duckduckgo' },
      { query: 'harness plugins' },
    )

    expect(url.origin).toBe('http://searxng:8080')
    expect(url.pathname).toBe('/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'harness plugins',
      format: 'json',
      safesearch: '2',
      language: 'pl',
      categories: 'general,it',
      engines: 'duckduckgo',
    })
  })

  it('does not double the slash on a base URL that ends in one', () => {
    expect(searchUrl({ ...OPTIONS, baseURL: 'http://searxng:8080/' }, { query: 'x' }).pathname)
      .toBe('/search')
  })

  it('omits what was not configured rather than sending empty values', () => {
    const params = searchUrl(OPTIONS, { query: 'x' }).searchParams
    expect(params.has('language')).toBe(false)
    expect(params.has('categories')).toBe(false)
    expect(params.has('engines')).toBe(false)
  })
})

describe('mapPayload', () => {
  it('keeps the first of a duplicated URL and drops results without one', () => {
    const result = mapPayload({
      results: [
        { url: 'https://a.example/1', title: 'First', content: 'snippet' },
        { url: 'https://a.example/1', title: 'Same page from another engine' },
        { title: 'no url at all' },
        { url: '', title: 'empty url' },
        { url: 'https://b.example/2' },
      ],
    })

    expect(result.sources).toEqual([
      { url: 'https://a.example/1', title: 'First', snippet: 'snippet' },
      { url: 'https://b.example/2' },
    ])
    expect(result.truncated).toBe(false)
  })

  it('omits optional fields rather than inventing them', () => {
    const [source] = mapPayload({ results: [{ url: 'https://a.example/1', title: '' }] }).sources
    expect(source).toEqual({ url: 'https://a.example/1' })
  })

  it('carries publishedDate through as publishedAt', () => {
    const [source] = mapPayload({
      results: [{ url: 'https://a.example/1', publishedDate: '2026-09-01T00:00:00Z' }],
    }).sources
    expect(source?.publishedAt).toBe('2026-09-01T00:00:00Z')
  })

  it.each([
    ['a bare string, as older instances return', ['42 is the answer']],
    ['an object, as current instances return', [{ answer: '42 is the answer' }]],
  ])('reads an answer given as %s', (_label, answers) => {
    expect(mapPayload({ results: [], answers }).content).toBe('42 is the answer')
  })

  it('has no content when the instance answered nothing', () => {
    expect(mapPayload({ results: [] }).content).toBeUndefined()
  })
})

describe('SearxngSearchProvider', () => {
  it('registers under a stable id', () => {
    expect(provider().id).toBe(SEARXNG_PROVIDER_ID)
  })

  it.each([
    ['an http instance', 'http://searxng:8080', true],
    ['an https instance', 'https://search.example', true],
    ['a relative path', '/search', false],
    ['an empty string', '', false],
    ['a non-http scheme', 'file:///etc/passwd', false],
  ])('reports %s as available=%s', (_label, baseURL, expected) => {
    expect(provider({ baseURL }).available()).toBe(expected)
  })

  it('returns mapped sources for a successful search', async () => {
    respondWith(JSON.stringify({
      results: [{ url: 'https://a.example/1', title: 'First', content: 'snippet' }],
    }))

    await expect(provider().search({ query: 'x' })).resolves.toEqual({
      sources: [{ url: 'https://a.example/1', title: 'First', snippet: 'snippet' }],
      truncated: false,
    })
  })

  // The single most common misconfiguration: `search.formats` omits `json` by
  // default, and the instance then answers the same URL with a results page
  // and HTTP 200. It must not read as "no results".
  it('names the settings.yml fix when the instance answers HTML', async () => {
    respondWith('<!doctype html><html><body>results</body></html>')

    await expect(provider().search({ query: 'x' })).rejects.toMatchObject({
      code: 'WEB_PROVIDER_ERROR',
      message: expect.stringContaining('search.formats'),
    })
  })

  it('reports a non-2xx answer with its status', async () => {
    respondWith('nope', { status: 502 })

    await expect(provider().search({ query: 'x' })).rejects.toMatchObject({
      code: 'WEB_PROVIDER_ERROR',
      message: expect.stringContaining('502'),
    })
  })

  it('reports an unreachable instance without leaking the query', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }))

    await expect(provider().search({ query: 'a private query' })).rejects.toMatchObject({
      code: 'WEB_PROVIDER_ERROR',
      message: expect.not.stringContaining('a private query'),
    })
  })

  it('surfaces the caller cancelling as a cancellation, not a provider fault', async () => {
    const controller = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async () => {
      controller.abort()
      throw new Error('aborted')
    }))

    await expect(provider().search({ query: 'x' }, controller.signal)).rejects.toMatchObject({
      code: 'WEB_CANCELLED',
    })
  })

  it('refuses to follow a redirect', async () => {
    const fetchMock = vi.fn(async () => new Response('{"results":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await provider().search({ query: 'x' })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'error' }),
    )
  })
})
