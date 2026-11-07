import 'server-only'

import { getRedisClient, redisUrlFromEnv } from '@/core/redis/client'

import {
  createMemoryRealtimePort,
  getMemoryRealtimePort,
} from './memory'
import type {
  RealtimeEvent,
  RealtimePayload,
  RealtimePort,
  RealtimeSubscribeHandler,
  RealtimeUnsubscribe,
} from './types'

const REDIS_CHANNEL = 'sf:realtime'

type FanoutGlobal = typeof globalThis & {
  __starforgeRealtimeRedisPort?: RealtimePort
  __starforgeRealtimeRedisSubReady?: boolean
  __starforgeRealtimeRecentIds?: Set<string>
}

function fanoutEnabled(): boolean {
  const mode = (process.env.STARFORGE_REALTIME_FANOUT || '').trim().toLowerCase()
  return mode === 'redis' && Boolean(redisUrlFromEnv())
}

function recentIds(): Set<string> {
  const g = globalThis as FanoutGlobal
  if (!g.__starforgeRealtimeRecentIds) {
    g.__starforgeRealtimeRecentIds = new Set()
  }
  return g.__starforgeRealtimeRecentIds
}

function rememberLocalEventId(id: string) {
  const set = recentIds()
  set.add(id)
  if (set.size > 500) {
    const first = set.values().next().value
    if (first) set.delete(first)
  }
}

/**
 * Wrap the in-process bus with Redis pub/sub so publish reaches other instances.
 * Local subscribe still uses memory handlers; Redis messages from other
 * instances are re-injected locally (same-process echoes are skipped).
 */
export function createRedisFanoutRealtimePort(
  inner: RealtimePort = createMemoryRealtimePort(),
): RealtimePort {
  const g = globalThis as FanoutGlobal

  const ensureSubscriber = () => {
    if (g.__starforgeRealtimeRedisSubReady) return
    g.__starforgeRealtimeRedisSubReady = true
    try {
      const sub = getRedisClient().duplicate()
      void sub.subscribe(REDIS_CHANNEL)
      sub.on('message', (_channel, message) => {
        try {
          const event = JSON.parse(message) as RealtimeEvent
          if (!event?.id || !event?.channel || !event?.type) return
          if (recentIds().has(event.id)) return
          rememberLocalEventId(event.id)
          void inner.publish(event.channel, event.type, (event.payload || {}) as RealtimePayload)
        } catch {
          // ignore bad payloads
        }
      })
    } catch {
      g.__starforgeRealtimeRedisSubReady = false
    }
  }

  ensureSubscriber()

  return {
    async publish(channel, type, payload: RealtimePayload = {}) {
      const event = await inner.publish(channel, type, payload)
      rememberLocalEventId(event.id)
      try {
        const redis = getRedisClient()
        await redis.publish(REDIS_CHANNEL, JSON.stringify(event))
      } catch {
        // Local publish already succeeded.
      }
      return event
    },

    subscribe(channel, handler: RealtimeSubscribeHandler): RealtimeUnsubscribe {
      ensureSubscriber()
      return inner.subscribe(channel, handler)
    },

    info() {
      const base = inner.info()
      return {
        ...base,
        adapter: 'redis-fanout' as const,
        label: 'Memory bus + Redis pub/sub fanout',
        detail: 'STARFORGE_REALTIME_FANOUT=redis — multi-instance SSE.',
      }
    },
  }
}

export function shouldUseRedisRealtimeFanout(): boolean {
  return fanoutEnabled()
}

export function getOrCreateRedisFanoutPort(): RealtimePort {
  const g = globalThis as FanoutGlobal
  if (!g.__starforgeRealtimeRedisPort) {
    g.__starforgeRealtimeRedisPort = createRedisFanoutRealtimePort(
      getMemoryRealtimePort(),
    )
  }
  return g.__starforgeRealtimeRedisPort
}
