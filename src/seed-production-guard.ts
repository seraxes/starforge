/**
 * Pure production refuse for `npm run seed`.
 * Call before any seed writes. Does not touch the database.
 */

export type SeedGuardEnv = {
  NODE_ENV?: string
  STARFORGE_ALLOW_PRODUCTION_SEED?: string
}

/**
 * Throws when `NODE_ENV=production` unless `STARFORGE_ALLOW_PRODUCTION_SEED=1`.
 * Unset / development / test / any other NODE_ENV is allowed (CI seed step).
 */
export function assertSeedAllowed(env: SeedGuardEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return
  if (env.STARFORGE_ALLOW_PRODUCTION_SEED === '1') return
  throw new Error(
    'Refusing to seed when NODE_ENV=production. Set STARFORGE_ALLOW_PRODUCTION_SEED=1 to override (local/demo only).',
  )
}
