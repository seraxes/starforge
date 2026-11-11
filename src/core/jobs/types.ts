/**
 * JobRunner — Core port for work that finishes after the HTTP request.
 *
 * One interface; memory adapter today (in-process). A Redis-backed adapter
 * may plug in later when REDIS_URL is set — do not add BullMQ or a worker
 * process for that. Product code calls enqueue only; handlers register by name.
 */

export type JobPayload = Record<string, unknown>

export type JobEnqueueInput = {
  /** Registered handler name. */
  name: string
  payload?: JobPayload
  /** Unix ms or Date — when in the future, the memory adapter uses a timer. */
  runAt?: number | Date
  /** When set, a second enqueue with the same key is a no-op. */
  idempotencyKey?: string
}

export type JobEnqueueResult = {
  ok: boolean
  /** Opaque id when accepted or deduped. */
  id?: string
  /** True when skipped because the idempotency key was already accepted. */
  deduped?: boolean
  /** Soft failure — unknown name, etc. Never throws through the caller. */
  error?: string
}

export type JobRunnerInfo = {
  adapter: 'memory'
  label: string
  ready: boolean
  detail?: string
}

export type JobHandler = (payload: JobPayload) => void | Promise<void>

export interface JobRunner {
  enqueue(input: JobEnqueueInput): Promise<JobEnqueueResult>
  info(): JobRunnerInfo
}
