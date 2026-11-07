/**
 * Sync snapshot of Site Settings → Performance realtime enable.
 * Adapters / SSE must not call getSiteSettings() on every publish (hot path).
 */

import {
  DEFAULT_REALTIME_ENABLED,
  coerceRealtimeEnabled,
} from '@/core/settings/defaults'

export type RealtimeRuntimeConfig = {
  /** When false, publish is a no-op fan-out and SSE refuses new connections. */
  enabled: boolean
}

const DEFAULT_CONFIG: RealtimeRuntimeConfig = {
  enabled: DEFAULT_REALTIME_ENABLED,
}

let snapshot: RealtimeRuntimeConfig = { ...DEFAULT_CONFIG }

export function getRealtimeRuntimeConfig(): RealtimeRuntimeConfig {
  return snapshot
}

export function setRealtimeRuntimeConfig(
  partial: Partial<{ enabled: unknown }>,
): RealtimeRuntimeConfig {
  snapshot = {
    enabled:
      partial.enabled === undefined
        ? snapshot.enabled
        : coerceRealtimeEnabled(partial.enabled),
  }
  return snapshot
}

/** Test helper. */
export function resetRealtimeRuntimeConfig(): void {
  snapshot = { ...DEFAULT_CONFIG }
}
