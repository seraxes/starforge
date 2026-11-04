import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { authSecondaryStorageKey, createSecondaryStorage } from './secondary-storage'

type MultiResult = [Error | null, unknown][] | null

function createMemoryRedis() {
  const store = new Map<string, { value: string; expiresAt?: number }>()

  function alive(key: string): string | null {
    const entry = store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      store.delete(key)
      return null
    }
    return entry.value
  }

  const redis = {
    async get(key: string) {
      return alive(key)
    },
    async set(key: string, value: string, ...args: unknown[]) {
      let expiresAt: number | undefined
      if (args[0] === 'EX' && typeof args[1] === 'number') {
        expiresAt = Date.now() + args[1] * 1000
      }
      store.set(key, { value, expiresAt })
      return 'OK'
    },
    async del(...keys: string[]) {
      let n = 0
      for (const key of keys) {
        if (store.delete(key)) n += 1
      }
      return n
    },
    async getdel(key: string) {
      const value = alive(key)
      store.delete(key)
      return value
    },
    multi() {
      const ops: Array<() => [Error | null, unknown]> = []
      const chain = {
        incr(key: string) {
          ops.push(() => {
            const current = Number(alive(key) ?? '0')
            const next = current + 1
            const existing = store.get(key)
            store.set(key, { value: String(next), expiresAt: existing?.expiresAt })
            return [null, next]
          })
          return chain
        },
        expire(key: string, ttl: number, mode?: string) {
          ops.push(() => {
            const entry = store.get(key)
            if (!entry) return [null, 0]
            if (mode === 'NX' && entry.expiresAt !== undefined) return [null, 0]
            entry.expiresAt = Date.now() + ttl * 1000
            return [null, 1]
          })
          return chain
        },
        async exec(): Promise<MultiResult> {
          return ops.map((op) => op())
        },
      }
      return chain
    },
  }

  return { redis, store }
}

describe('auth secondary storage', () => {
  it('prefixes keys with STARFORGE_REDIS_PREFIX :ba:', () => {
    const saved = process.env.STARFORGE_REDIS_PREFIX
    try {
      process.env.STARFORGE_REDIS_PREFIX = 'sf:test'
      assert.equal(authSecondaryStorageKey('rate-limit:ip'), 'sf:test:ba:rate-limit:ip')
    } finally {
      if (saved === undefined) delete process.env.STARFORGE_REDIS_PREFIX
      else process.env.STARFORGE_REDIS_PREFIX = saved
    }
  })

  it('get / set / delete / getAndDelete round-trip', async () => {
    const { redis, store } = createMemoryRedis()
    const storage = createSecondaryStorage(redis as never)
    const saved = process.env.STARFORGE_REDIS_PREFIX
    process.env.STARFORGE_REDIS_PREFIX = 'sf:test'
    try {
      await storage.set('session-a', JSON.stringify({ ok: true }), 60)
      assert.equal(await storage.get('session-a'), JSON.stringify({ ok: true }))
      assert.ok(store.has('sf:test:ba:session-a'))

      const taken = await storage.getAndDelete('session-a')
      assert.equal(taken, JSON.stringify({ ok: true }))
      assert.equal(await storage.get('session-a'), null)

      await storage.set('tmp', '1')
      await storage.delete('tmp')
      assert.equal(await storage.get('tmp'), null)
    } finally {
      if (saved === undefined) delete process.env.STARFORGE_REDIS_PREFIX
      else process.env.STARFORGE_REDIS_PREFIX = saved
    }
  })

  it('increment sets TTL only on first create', async () => {
    const { redis, store } = createMemoryRedis()
    const storage = createSecondaryStorage(redis as never)
    const saved = process.env.STARFORGE_REDIS_PREFIX
    process.env.STARFORGE_REDIS_PREFIX = 'sf:test'
    try {
      assert.equal(await storage.increment('rl:login', 30), 1)
      const firstExpiry = store.get('sf:test:ba:rl:login')?.expiresAt
      assert.ok(typeof firstExpiry === 'number')

      assert.equal(await storage.increment('rl:login', 30), 2)
      assert.equal(store.get('sf:test:ba:rl:login')?.expiresAt, firstExpiry)
      assert.equal(store.get('sf:test:ba:rl:login')?.value, '2')
    } finally {
      if (saved === undefined) delete process.env.STARFORGE_REDIS_PREFIX
      else process.env.STARFORGE_REDIS_PREFIX = saved
    }
  })
})
