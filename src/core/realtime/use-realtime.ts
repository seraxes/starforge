'use client'

import { useEffect, useRef } from 'react'

import { connectRealtime } from './client'
import type { RealtimeEvent } from './types'

export type UseRealtimeChannelOptions = {
  /** When false, no connection is opened. */
  enabled?: boolean
  channels: readonly string[]
  onEvent: (event: RealtimeEvent) => void
  onError?: (error: unknown) => void
}

/**
 * Subscribe to RealtimePort channels via SSE.
 * Pass a stable `onEvent` (or accept identity changes reconnecting).
 */
export function useRealtimeChannel(options: UseRealtimeChannelOptions): void {
  const { enabled = true, channels, onEvent, onError } = options
  const onEventRef = useRef(onEvent)
  const onErrorRef = useRef(onError)
  onEventRef.current = onEvent
  onErrorRef.current = onError

  const channelKey = channels.join(',')

  useEffect(() => {
    if (!enabled || !channelKey) return

    const list = channelKey.split(',').filter(Boolean)
    if (list.length === 0) return

    const handle = connectRealtime({
      channels: list,
      onEvent: (event) => onEventRef.current(event),
      onError: (error) => onErrorRef.current?.(error),
    })

    return () => {
      handle.close()
    }
  }, [enabled, channelKey])
}
