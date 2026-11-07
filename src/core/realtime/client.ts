/**
 * Browser EventSource helper for `/api/realtime`.
 * Safe to import from client components (no `server-only`).
 */

import type { RealtimeEvent } from './types'

export type RealtimeClientOptions = {
  /** Channel names (v1: typically `user:{id}`). */
  channels: readonly string[]
  /** Called for each parsed SSE data event. */
  onEvent: (event: RealtimeEvent) => void
  /** Optional connection / parse errors. */
  onError?: (error: unknown) => void
  /** Base path; default `/api/realtime`. */
  path?: string
}

export type RealtimeClientHandle = {
  /** Close the EventSource. */
  close: () => void
}

function isRealtimeEvent(value: unknown): value is RealtimeEvent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.channel === 'string' &&
    typeof v.type === 'string' &&
    typeof v.at === 'number' &&
    v.payload !== null &&
    typeof v.payload === 'object'
  )
}

/**
 * Open an authenticated SSE subscription (cookies via same-origin EventSource).
 * Browser auto-reconnects; call `close()` on unmount.
 */
export function connectRealtime(options: RealtimeClientOptions): RealtimeClientHandle {
  if (typeof EventSource === 'undefined') {
    options.onError?.(new Error('EventSource is not available in this environment'))
    return { close: () => undefined }
  }

  const channels = options.channels.map((c) => c.trim()).filter(Boolean)
  if (channels.length === 0) {
    options.onError?.(new Error('connectRealtime: at least one channel is required'))
    return { close: () => undefined }
  }

  const path = options.path ?? '/api/realtime'
  const url = `${path}?channels=${encodeURIComponent(channels.join(','))}`
  const source = new EventSource(url)

  source.onmessage = (message) => {
    try {
      const parsed: unknown = JSON.parse(message.data)
      if (!isRealtimeEvent(parsed)) {
        options.onError?.(new Error('Invalid realtime event payload'))
        return
      }
      options.onEvent(parsed)
    } catch (error) {
      options.onError?.(error)
    }
  }

  source.onerror = () => {
    // EventSource reconnects automatically; surface a soft signal only.
    if (source.readyState === EventSource.CLOSED) {
      options.onError?.(new Error('Realtime SSE connection closed'))
    }
  }

  return {
    close: () => {
      source.close()
    },
  }
}
