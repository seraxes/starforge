import { randomUUID } from 'node:crypto'

import { getRealtimeRuntimeConfig } from './runtime-config'
import type {
  RealtimeEvent,
  RealtimePayload,
  RealtimePort,
  RealtimeSubscribeHandler,
  RealtimeUnsubscribe,
} from './types'

type ChannelHandlers = Set<RealtimeSubscribeHandler>

type MemoryBusGlobal = typeof globalThis & {
  __starforgeRealtimeMemoryBus?: Map<string, ChannelHandlers>
  __starforgeRealtimePort?: RealtimePort
}

function busMap(): Map<string, ChannelHandlers> {
  const g = globalThis as MemoryBusGlobal
  if (!g.__starforgeRealtimeMemoryBus) {
    g.__starforgeRealtimeMemoryBus = new Map()
  }
  return g.__starforgeRealtimeMemoryBus
}

/** Test helper — drop all in-process subscribers. */
export function clearMemoryRealtimeBus(): void {
  busMap().clear()
}

export function createMemoryRealtimePort(): RealtimePort {
  return {
    async publish(channel, type, payload: RealtimePayload = {}): Promise<RealtimeEvent> {
      const trimmed = channel.trim()
      if (!trimmed) {
        throw new Error('RealtimePort.publish: channel is required')
      }
      const eventType = type.trim()
      if (!eventType) {
        throw new Error('RealtimePort.publish: type is required')
      }

      const event: RealtimeEvent = {
        id: randomUUID(),
        channel: trimmed,
        type: eventType,
        payload,
        at: Date.now(),
      }

      if (!getRealtimeRuntimeConfig().enabled) {
        return event
      }

      const handlers = busMap().get(trimmed)
      if (handlers) {
        for (const handler of [...handlers]) {
          try {
            handler(event)
          } catch {
            // One bad subscriber must not break fan-out.
          }
        }
      }

      return event
    },

    subscribe(channel, handler): RealtimeUnsubscribe {
      const trimmed = channel.trim()
      if (!trimmed) {
        throw new Error('RealtimePort.subscribe: channel is required')
      }

      const map = busMap()
      let handlers = map.get(trimmed)
      if (!handlers) {
        handlers = new Set()
        map.set(trimmed, handlers)
      }
      handlers.add(handler)

      return () => {
        const current = map.get(trimmed)
        if (!current) return
        current.delete(handler)
        if (current.size === 0) map.delete(trimmed)
      }
    },

    info() {
      const enabled = getRealtimeRuntimeConfig().enabled
      return {
        adapter: 'memory' as const,
        label: 'In-process memory bus',
        ready: enabled,
        detail: enabled
          ? 'Single Node process only. Redis fanout later for multi-instance.'
          : 'Disabled in Site Settings → Performance (realtimeEnabled).',
      }
    },
  }
}

/**
 * Active RealtimePort singleton (memory bus).
 * Prefer `@/core/realtime` `getRealtimePort` which may wrap Redis fanout.
 */
export function getMemoryRealtimePort(): RealtimePort {
  const g = globalThis as MemoryBusGlobal
  if (!g.__starforgeRealtimePort) {
    g.__starforgeRealtimePort = createMemoryRealtimePort()
  }
  return g.__starforgeRealtimePort
}

/** @deprecated Use getMemoryRealtimePort or `@/core/realtime` getRealtimePort. */
export function getRealtimePort(): RealtimePort {
  return getMemoryRealtimePort()
}

/** Test helper — drop the lazy singleton (bus map cleared separately). */
export function resetRealtimePortForTests(): void {
  const g = globalThis as MemoryBusGlobal
  delete g.__starforgeRealtimePort
}
