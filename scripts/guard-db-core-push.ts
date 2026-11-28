/**
 * Refuse `db:core:push` unless STARFORGE_ALLOW_PUSH=1 and DATABASE_URL
 * points at localhost. drizzle-kit push is not a migrate path.
 *
 * Usage: npm run db:core:push
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export type DbPushGuardDecision =
  | { allowed: true }
  | { allowed: false; reason: string }

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

export function databaseUrlHostname(databaseUrl: string): string | null {
  const trimmed = databaseUrl.trim()
  if (!trimmed) return null
  try {
    const hostname = new URL(trimmed).hostname
    return hostname.replace(/^\[|\]$/g, '').toLowerCase()
  } catch {
    return null
  }
}

export function databaseUrlPointsAtLocalhost(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false
  const host = databaseUrlHostname(databaseUrl)
  if (!host) return false
  return LOCAL_HOSTS.has(host)
}

/** Pure guard. Does not spawn drizzle-kit. */
export function evaluateDbCorePushGuard(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): DbPushGuardDecision {
  if (env.STARFORGE_ALLOW_PUSH !== '1') {
    return {
      allowed: false,
      reason:
        'db:core:push refused: set STARFORGE_ALLOW_PUSH=1 to run drizzle-kit push.',
    }
  }
  if (!databaseUrlPointsAtLocalhost(env.DATABASE_URL)) {
    return {
      allowed: false,
      reason:
        'db:core:push refused: DATABASE_URL must point at localhost (localhost, 127.0.0.1, or ::1).',
    }
  }
  return { allowed: true }
}

function drizzleKitBin(): string {
  return path.join(ROOT, 'node_modules', 'drizzle-kit', 'bin.cjs')
}

function invokedDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const invoked = path.resolve(entry).replace(/\\/g, '/').toLowerCase()
  const self = fileURLToPath(import.meta.url).replace(/\\/g, '/').toLowerCase()
  return invoked === self
}

function main(): void {
  const decision = evaluateDbCorePushGuard(process.env)
  if (!decision.allowed) {
    console.error(decision.reason)
    process.exitCode = 1
    return
  }
  const result = spawnSync(process.execPath, [drizzleKitBin(), 'push'], {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  })
  if (result.status !== 0) process.exitCode = result.status ?? 1
}

if (invokedDirectly()) {
  main()
}
