/**
 * Pure System health glance (Dashboard `system.health`).
 * Callers pass probe results — no DB, Redis, or env values in the formatted rows.
 */

export type HealthLevel = 'ok' | 'warn' | 'fail' | 'skip'

export type HealthRow = {
  key: 'database' | 'redis' | 'media' | 'migrations'
  label: string
  level: HealthLevel
  value: string
}

export type SystemHealthGlance = {
  level: 'ok' | 'warn' | 'fail'
  levelLabel: string
  rows: HealthRow[]
}

export type RedisProbe = 'skip' | 'missing' | 'up' | 'down'

export type MigrationProbe = {
  /** False when the database probe already failed — do not invent a version. */
  databaseUp: boolean
  /** Null when the migrations table could not be read. */
  appliedCount: number | null
  expectedCount: number
  expectedTag: string | null
  /** True when `drizzle.__drizzle_migrations` (or its schema) is absent. */
  relationMissing: boolean
}

const LEVEL_LABEL = {
  ok: 'Healthy',
  warn: 'Check',
  fail: 'Unhealthy',
} as const

type RedisEnv = {
  STARFORGE_CONTENT_CACHE?: string
  REDIS_URL?: string
}

function redisEnv(env?: RedisEnv): RedisEnv {
  return env ?? process.env
}

/** Redis is in play when the content cache selects it, or when `REDIS_URL` is set. */
export function isRedisSelected(env?: RedisEnv): boolean {
  const source = redisEnv(env)
  const cache = (source.STARFORGE_CONTENT_CACHE ?? '').trim().toLowerCase()
  if (cache === 'redis') return true
  return Boolean((source.REDIS_URL ?? '').trim())
}

/**
 * `configured` means a URL is present and a ping should run.
 * `missing` means Redis is selected (`STARFORGE_CONTENT_CACHE=redis`) without `REDIS_URL`.
 */
export function classifyRedisSelection(env?: RedisEnv): 'skip' | 'configured' | 'missing' {
  const source = redisEnv(env)
  if (!isRedisSelected(source)) return 'skip'
  if (!(source.REDIS_URL ?? '').trim()) return 'missing'
  return 'configured'
}

export function formatMigrationGlance(probe: MigrationProbe): Pick<HealthRow, 'level' | 'value'> {
  if (!probe.databaseUp) return { level: 'fail', value: 'Unavailable' }
  if (probe.relationMissing) return { level: 'warn', value: 'Untracked' }
  if (probe.appliedCount == null) return { level: 'warn', value: 'Unknown' }
  if (probe.expectedCount > 0 && probe.appliedCount < probe.expectedCount) {
    return {
      level: 'warn',
      value: `Behind ${probe.appliedCount}/${probe.expectedCount}`,
    }
  }
  const tag = probe.expectedTag?.trim()
  return { level: 'ok', value: tag || String(probe.appliedCount) }
}

export function rollupHealthLevel(levels: readonly HealthLevel[]): 'ok' | 'warn' | 'fail' {
  if (levels.includes('fail')) return 'fail'
  if (levels.includes('warn')) return 'warn'
  return 'ok'
}

export function assembleSystemHealth(input: {
  databaseUp: boolean
  redis: RedisProbe
  mediaReady: boolean
  mediaLabel: string
  migration: MigrationProbe
}): SystemHealthGlance {
  const migration = formatMigrationGlance(input.migration)
  const redis: Pick<HealthRow, 'level' | 'value'> =
    input.redis === 'skip'
      ? { level: 'skip', value: 'Not selected' }
      : input.redis === 'missing'
        ? { level: 'fail', value: 'Not configured' }
        : input.redis === 'up'
          ? { level: 'ok', value: 'Up' }
          : { level: 'fail', value: 'Down' }

  const mediaLabel = input.mediaLabel.trim() || 'Storage'
  const rows: HealthRow[] = [
    {
      key: 'database',
      label: 'Database',
      level: input.databaseUp ? 'ok' : 'fail',
      value: input.databaseUp ? 'Up' : 'Down',
    },
    { key: 'redis', label: 'Redis', ...redis },
    {
      key: 'media',
      label: 'Media storage',
      level: input.mediaReady ? 'ok' : 'fail',
      value: input.mediaReady ? mediaLabel : 'Not ready',
    },
    { key: 'migrations', label: 'Migrations', ...migration },
  ]

  const level = rollupHealthLevel(rows.map((row) => row.level))
  return { level, levelLabel: LEVEL_LABEL[level], rows }
}

export function expectedMigrationFromJournal(doc: {
  entries?: ReadonlyArray<{ tag?: string }>
}): { count: number; tag: string | null } {
  const entries = Array.isArray(doc.entries) ? doc.entries : []
  const last = entries[entries.length - 1]
  const tag = typeof last?.tag === 'string' ? last.tag.trim() : ''
  return { count: entries.length, tag: tag || null }
}
