/**
 * RealtimePort — Core push transport (SSE now; Redis fanout later).
 *
 * Modules (Notifications, Chat, live Maps) call `publish` only.
 * Browser clients open `/api/realtime` — never vendor SDKs in product packs.
 * Voice/video calling is a separate future RTC port, not this interface.
 */

export type RealtimePayload = Record<string, unknown>

export type RealtimeEvent = {
  /** Opaque id for SSE `id:` / last-event-id (optional client resume later). */
  id: string
  /** Channel name, e.g. `user:{userId}`, later `chat:{roomId}`. */
  channel: string
  /** Product event type, e.g. `notification.created`. */
  type: string
  payload: RealtimePayload
  /** Unix ms. */
  at: number
}

export type RealtimeSubscribeHandler = (event: RealtimeEvent) => void

export type RealtimeUnsubscribe = () => void

export type RealtimeInfo = {
  /** Active adapter id. */
  adapter: 'memory'
  label: string
  /** True when publish/subscribe are usable. */
  ready: boolean
  detail?: string
}

export interface RealtimePort {
  publish(channel: string, type: string, payload?: RealtimePayload): Promise<RealtimeEvent>
  subscribe(channel: string, handler: RealtimeSubscribeHandler): RealtimeUnsubscribe
  info(): RealtimeInfo
}
