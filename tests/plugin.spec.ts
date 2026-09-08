import { describe, expect, it, vi } from 'vitest'

import { Config, SEARXNG_PROVIDER_ID, apply, inject, name } from '../src/index.js'
import type { SearxngSearchProvider } from '../src/provider.js'

/**
 * A stand-in for the slice of Cordis this plugin touches: the web seam it
 * registers into and the effect wrapper that owns the disposer.
 */
function fakeContext(): {
  readonly ctx: Parameters<typeof apply>[0]
  readonly registered: SearxngSearchProvider[]
  readonly disposed: () => boolean
  readonly effectDisposer: () => (() => void) | undefined
} {
  const registered: SearxngSearchProvider[] = []
  let unregistered = false
  let disposer: (() => void) | undefined
  const ctx = {
    web: {
      registerSearchProvider: (provider: SearxngSearchProvider) => {
        registered.push(provider)
        return () => {
          unregistered = true
        }
      },
    },
    effect: vi.fn((factory: () => () => void) => {
      disposer = factory()
    }),
  }
  return {
    ctx: ctx as unknown as Parameters<typeof apply>[0],
    registered,
    disposed: () => unregistered,
    effectDisposer: () => disposer,
  }
}

describe('plugin surface', () => {
  it('declares the seam it needs', () => {
    expect(name).toBe('dsh-web-search-searxng')
    expect(inject).toEqual(['web'])
  })

  it('registers one provider, under the documented id, inside an effect', () => {
    const { ctx, registered } = fakeContext()

    apply(ctx, { baseURL: 'http://searxng:8080' })

    expect(registered).toHaveLength(1)
    expect(registered[0]?.id).toBe(SEARXNG_PROVIDER_ID)
    expect(ctx.effect).toHaveBeenCalledOnce()
  })

  // The disposer belongs to the effect, not to the caller: Cordis unregisters
  // the provider when the fiber ends, so `apply` returns nothing.
  it('gives the effect a disposer that unregisters the provider', () => {
    const { ctx, disposed, effectDisposer } = fakeContext()

    expect(apply(ctx, { baseURL: 'http://searxng:8080' })).toBeUndefined()
    expect(disposed()).toBe(false)

    effectDisposer()?.()
    expect(disposed()).toBe(true)
  })

  // Configuration can change while the harness runs; a provider that captured
  // its options once would keep searching under the old instance.
  it('reads the options at search time, not at registration time', () => {
    const { ctx, registered } = fakeContext()
    const config = { baseURL: '' }

    apply(ctx, config)
    expect(registered[0]?.available()).toBe(false)

    config.baseURL = 'https://search.example'
    expect(registered[0]?.available()).toBe(true)
  })
})

describe('Config', () => {
  it('defaults the timeout and safe-search level', () => {
    const resolved = new Config({ baseURL: 'http://searxng:8080' })
    expect(resolved.timeoutMs).toBe(15_000)
    expect(resolved.safeSearch).toBe(0)
  })

  it.each([
    ['below the floor', 999],
    ['above the ceiling', 120_001],
  ])('rejects a timeout %s', (_label, timeoutMs) => {
    expect(() => new Config({ baseURL: 'http://searxng:8080', timeoutMs })).toThrow()
  })

  it('rejects a safe-search level SearXNG does not define', () => {
    expect(() => new Config({
      baseURL: 'http://searxng:8080',
      safeSearch: 3 as 0 | 1 | 2,
    })).toThrow()
  })

  it('leaves the optional tuning keys unset rather than inventing defaults', () => {
    const resolved = new Config({ baseURL: 'http://searxng:8080' })
    expect(resolved.language).toBeUndefined()
    expect(resolved.categories).toBeUndefined()
    expect(resolved.engines).toBeUndefined()
  })
})
