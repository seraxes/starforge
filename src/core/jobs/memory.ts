import { randomUUID } from 'node:crypto'

import { getJobHandler } from './handlers'
import type {
  JobEnqueueInput,
  JobEnqueueResult,
  JobPayload,
  JobRunner,
} from './types'

type MemoryState = {
  idempotency: Set<string>
  timers: Set<ReturnType<typeof setTimeout>>
}

type MemoryGlobal = typeof globalThis & {
  __starforgeJobMemoryState?: MemoryState
  __starforgeMemoryJobRunner?: JobRunner
}

function state(): MemoryState {
  const g = globalThis as MemoryGlobal
  if (!g.__starforgeJobMemoryState) {
    g.__starforgeJobMemoryState = {
      idempotency: new Set(),
      timers: new Set(),
    }
  }
  return g.__starforgeJobMemoryState
}

function resolveRunAtMs(runAt: JobEnqueueInput['runAt']): number | null {
  if (runAt == null) return null
  if (runAt instanceof Date) {
    const ms = runAt.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  return Number.isFinite(runAt) ? runAt : null
}

function schedule(delayMs: number, run: () => void): void {
  const s = state()
  const handle = setTimeout(() => {
    s.timers.delete(handle)
    run()
  }, Math.max(0, delayMs))
  // Unref so a pending delayed job does not keep the Node process alive in tests/CLI.
  if (typeof handle.unref === 'function') {
    handle.unref()
  }
  s.timers.add(handle)
}

async function runHandlerSafe(name: string, payload: JobPayload): Promise<void> {
  const handler = getJobHandler(name)
  if (!handler) return
  try {
    await handler(payload)
  } catch {
    // Handler failures must not surface to the enqueue caller.
  }
}

export function createMemoryJobRunner(): JobRunner {
  return {
    async enqueue(input: JobEnqueueInput): Promise<JobEnqueueResult> {
      const name = (input.name ?? '').trim()
      if (!name) {
        return { ok: false, error: 'Job name is required' }
      }

      if (!getJobHandler(name)) {
        return { ok: false, error: `Unknown job: ${name}` }
      }

      const key = input.idempotencyKey?.trim()
      const s = state()
      if (key) {
        if (s.idempotency.has(key)) {
          return { ok: true, id: key, deduped: true }
        }
        s.idempotency.add(key)
      }

      const id = key || randomUUID()
      const payload: JobPayload = input.payload ?? {}
      const runAtMs = resolveRunAtMs(input.runAt)
      const delayMs = runAtMs == null ? 0 : Math.max(0, runAtMs - Date.now())

      schedule(delayMs, () => {
        void runHandlerSafe(name, payload)
      })

      return { ok: true, id }
    },

    info() {
      return {
        adapter: 'memory' as const,
        label: 'In-process memory runner',
        ready: true,
        detail:
          'Single Node process only. Delayed jobs use timers. Redis-backed runner later when REDIS_URL is set.',
      }
    },
  }
}

/**
 * Active memory JobRunner singleton.
 * Prefer `@/core/jobs` `getJobRunner`.
 */
export function getMemoryJobRunner(): JobRunner {
  const g = globalThis as MemoryGlobal
  if (!g.__starforgeMemoryJobRunner) {
    g.__starforgeMemoryJobRunner = createMemoryJobRunner()
  }
  return g.__starforgeMemoryJobRunner
}

/** Test helper — clear timers, idempotency keys, and the memory singleton. */
export function resetMemoryJobRunnerForTests(): void {
  const g = globalThis as MemoryGlobal
  const s = g.__starforgeJobMemoryState
  if (s) {
    for (const handle of s.timers) {
      clearTimeout(handle)
    }
    s.timers.clear()
    s.idempotency.clear()
  }
  delete g.__starforgeMemoryJobRunner
  delete g.__starforgeJobMemoryState
}
