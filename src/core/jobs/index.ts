/**
 * JobRunner port — work after the HTTP request.
 *
 * - No `REDIS_URL`: in-process memory adapter (local / single process)
 * - Redis-backed adapter later when multi-instance needs it — not BullMQ
 *
 * Handlers register with `registerJobHandler`. Unknown names soft-fail on enqueue.
 */

export type {
  JobEnqueueInput,
  JobEnqueueResult,
  JobHandler,
  JobPayload,
  JobRunner,
  JobRunnerInfo,
} from './types'
export {
  clearJobHandlers,
  getJobHandler,
  registerJobHandler,
} from './handlers'
export {
  createMemoryJobRunner,
  getMemoryJobRunner,
  resetMemoryJobRunnerForTests,
} from './memory'

import { clearJobHandlers } from './handlers'
import {
  getMemoryJobRunner,
  resetMemoryJobRunnerForTests,
} from './memory'
import type { JobRunner } from './types'

type PortGlobal = typeof globalThis & {
  __starforgeJobRunner?: JobRunner
}

/**
 * Active JobRunner.
 *
 * - No `REDIS_URL` (or Redis adapter not built yet): in-process memory
 * - Later: Redis-backed adapter when multi-instance needs shared delayed work
 *
 * Callers must not assume cross-process delivery until a Redis adapter ships.
 */
export function getJobRunner(): JobRunner {
  const g = globalThis as PortGlobal
  if (!g.__starforgeJobRunner) {
    // Memory is the only adapter today (default when REDIS_URL is empty).
    g.__starforgeJobRunner = getMemoryJobRunner()
  }
  return g.__starforgeJobRunner
}

/** Test helper — drop resolved + memory singletons and handlers. */
export function resetJobRunnerForTests(): void {
  const g = globalThis as PortGlobal
  delete g.__starforgeJobRunner
  resetMemoryJobRunnerForTests()
  clearJobHandlers()
}
