import 'server-only'

import type { DashboardStatsResult } from '@/core/dashboard'

import { assembleHostPulse, type HostPulseStats } from './host-pulse'

export type { HostPulseStats } from './host-pulse'

function asBytes(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
  if (typeof value === 'bigint' && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number(value)
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : null
  }
  return null
}

async function sumLibraryBytes(): Promise<number | null> {
  const { pool } = await import('@/core/db')
  const result = await pool.query<{ bytes: string | number | null }>(
    `SELECT COALESCE(SUM(filesize), 0)::bigint AS bytes FROM payload.media`,
  )
  return asBytes(result.rows[0]?.bytes)
}

async function readDatabaseBytes(): Promise<number | null> {
  const { pool } = await import('@/core/db')
  const result = await pool.query<{ bytes: string | number | null }>(
    `SELECT pg_database_size(current_database())::bigint AS bytes`,
  )
  return asBytes(result.rows[0]?.bytes)
}

/**
 * Process uptime, resident memory, media library bytes, and Postgres size.
 * A missing library table leaves that cell as "—" and keeps the rest.
 */
export async function loadHostPulseStats(): Promise<DashboardStatsResult<HostPulseStats>> {
  let libraryBytes: number | null = null
  let databaseBytes: number | null = null

  try {
    libraryBytes = await sumLibraryBytes()
  } catch (error) {
    console.error('[dashboard] host.pulse library size unread')
    void error
  }

  try {
    databaseBytes = await readDatabaseBytes()
  } catch (error) {
    console.error('[dashboard] host.pulse database size unread')
    void error
  }

  const memory = process.memoryUsage().rss
  return {
    ok: true,
    data: assembleHostPulse({
      uptimeSec: process.uptime(),
      nodeVersion: process.version,
      memoryBytes: memory,
      libraryBytes,
      databaseBytes,
    }),
  }
}
