import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

const connectionString =
  process.env.DATABASE_URL || 'postgresql://starforge:starforge@127.0.0.1:5432/starforge'

const globalForDb = globalThis as unknown as {
  starforgePool?: Pool
}

const pool =
  globalForDb.starforgePool ??
  new Pool({
    connectionString,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.starforgePool = pool
}

/** Drizzle client for Starforge core tables (public schema). */
export const db = drizzle(pool, { schema })

export { pool }
export * from './schema'
