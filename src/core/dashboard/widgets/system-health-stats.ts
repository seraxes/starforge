import 'server-only'

import { cache } from 'react'
import { sql } from 'drizzle-orm'

import type { DashboardStatsResult } from '@/core/dashboard'
import { db } from '@/core/db'
import journal from '@/core/db/migrations/meta/_journal.json'
import { getMediaStorageInfo } from '@/core/media/storage'

import {
  assembleSystemHealth,
  classifyRedisSelection,
  expectedMigrationFromJournal,
  type MigrationProbe,
  type RedisProbe,
  type SystemHealthGlance,
} from './system-health'

export type { SystemHealthGlance } from './system-health'

function countFromExecute(result: unknown): number | null {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === 'object' && Array.isArray((result as { rows?: unknown }).rows)
      ? (result as { rows: unknown[] }).rows
      : []
  const row = rows[0] as { n?: unknown } | undefined
  const n = row?.n
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string' && /^\d+$/.test(n)) return Number(n)
  return null
}

function isMissingRelation(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : ''
  if (code === '42P01' || code === '3F000') return true
  const message = error instanceof Error ? error.message : String(error)
  return /does not exist/i.test(message)
}

async function probeDatabase(): Promise<boolean> {
  await db.execute(sql`select 1`)
  return true
}

async function probeRedis(selection: ReturnType<typeof classifyRedisSelection>): Promise<RedisProbe> {
  if (selection === 'skip') return 'skip'
  if (selection === 'missing') return 'missing'
  const url = (process.env.REDIS_URL ?? '').trim()
  if (!url) return 'missing'

  const { default: Redis } = await import('ioredis')
  const client = new Redis(url, {
    connectTimeout: 1500,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableReadyCheck: false,
    retryStrategy: () => null,
  })
  try {
    await Promise.race([
      client.connect().then(() => client.ping()),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('redis ping timed out')), 1600)
      }),
    ])
    return 'up'
  } catch (error) {
    console.error('[dashboard] system.health redis ping failed')
    void error
    return 'down'
  } finally {
    client.disconnect()
  }
}

async function probeMigrations(databaseUp: boolean): Promise<MigrationProbe> {
  const expected = expectedMigrationFromJournal(journal)
  if (!databaseUp) {
    return {
      databaseUp: false,
      appliedCount: null,
      expectedCount: expected.count,
      expectedTag: expected.tag,
      relationMissing: false,
    }
  }
  try {
    const result = await db.execute(sql`
      select count(*)::int as n
      from drizzle.__drizzle_migrations
    `)
    return {
      databaseUp: true,
      appliedCount: countFromExecute(result),
      expectedCount: expected.count,
      expectedTag: expected.tag,
      relationMissing: false,
    }
  } catch (error) {
    return {
      databaseUp: true,
      appliedCount: null,
      expectedCount: expected.count,
      expectedTag: expected.tag,
      relationMissing: isMissingRelation(error),
    }
  }
}

async function loadSystemHealthUncached(): Promise<DashboardStatsResult<SystemHealthGlance>> {
  let databaseUp = false
  try {
    databaseUp = await probeDatabase()
  } catch (error) {
    console.error('[dashboard] system.health database probe failed')
    void error
  }

  let redis: RedisProbe = 'skip'
  try {
    redis = await probeRedis(classifyRedisSelection())
  } catch (error) {
    console.error('[dashboard] system.health redis probe failed')
    void error
    redis = classifyRedisSelection() === 'skip' ? 'skip' : 'down'
  }

  let mediaReady = false
  let mediaLabel = 'Storage'
  try {
    const info = getMediaStorageInfo()
    mediaReady = info.ready
    mediaLabel = info.label
  } catch (error) {
    console.error('[dashboard] system.health media probe failed')
    void error
  }

  const migration = await probeMigrations(databaseUp)

  return {
    ok: true,
    data: assembleSystemHealth({
      databaseUp,
      redis,
      mediaReady,
      mediaLabel,
      migration,
    }),
  }
}

/** Shared per request so the health card and the attention rail ping once. */
export const loadSystemHealthStats = cache(loadSystemHealthUncached)
