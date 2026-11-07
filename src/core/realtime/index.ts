import 'server-only'

export {
  USER_CHANNEL_PREFIX,
  MAP_CHANNEL_PREFIX,
  canSubscribe,
  filterSubscribableChannels,
  filterSubscribableChannelsAsync,
  parseRealtimeChannels,
  userChannel,
} from './channels'
export type { RealtimeChannelAclChecker } from './channels'
export {
  clearMemoryRealtimeBus,
  createMemoryRealtimePort,
  getMemoryRealtimePort,
  resetRealtimePortForTests,
} from './memory'
export {
  getRealtimeRuntimeConfig,
  resetRealtimeRuntimeConfig,
  setRealtimeRuntimeConfig,
} from './runtime-config'
export type { RealtimeRuntimeConfig } from './runtime-config'
export type {
  RealtimeEvent,
  RealtimeInfo,
  RealtimePayload,
  RealtimePort,
  RealtimeSubscribeHandler,
  RealtimeUnsubscribe,
} from './types'

import {
  getOrCreateRedisFanoutPort,
  shouldUseRedisRealtimeFanout,
} from './redis-fanout'
import {
  getMemoryRealtimePort,
  resetRealtimePortForTests as resetMemoryRealtimePortForTests,
} from './memory'
import type { RealtimePort } from './types'

type PortGlobal = typeof globalThis & {
  __starforgeRealtimeResolvedPort?: RealtimePort
}

/**
 * Active RealtimePort — memory bus, or Redis fanout when
 * `STARFORGE_REALTIME_FANOUT=redis` and `REDIS_URL` are set.
 */
export function getRealtimePort(): RealtimePort {
  const g = globalThis as PortGlobal
  if (!g.__starforgeRealtimeResolvedPort) {
    g.__starforgeRealtimeResolvedPort = shouldUseRedisRealtimeFanout()
      ? getOrCreateRedisFanoutPort()
      : getMemoryRealtimePort()
  }
  return g.__starforgeRealtimeResolvedPort
}

/** Test helper — drop resolved + memory singletons. */
export function resetResolvedRealtimePortForTests(): void {
  const g = globalThis as PortGlobal
  delete g.__starforgeRealtimeResolvedPort
  resetMemoryRealtimePortForTests()
}
