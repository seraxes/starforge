import { NextResponse } from 'next/server'
import { headers } from 'next/headers'

import { auth } from '@/core/auth'
import {
  filterSubscribableChannelsAsync,
  getRealtimePort,
  getRealtimeRuntimeConfig,
  parseRealtimeChannels,
  userChannel,
  type RealtimeEvent,
} from '@/core/realtime'
import { canSubscribeMapChannel } from '@/modules/maps/realtime-acl'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HEARTBEAT_MS = 20_000

function encodeSseEvent(event: RealtimeEvent): string {
  return `id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * Authenticated SSE stream.
 * Query: `channels` comma-separated (v1: only `user:{sessionUserId}`).
 * Default when omitted: the caller's personal channel.
 */
export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!getRealtimeRuntimeConfig().enabled) {
    return NextResponse.json(
      {
        error: 'Realtime disabled',
        hint: 'Enable RealtimePort under Settings → Performance.',
      },
      { status: 503 },
    )
  }

  const userId = session.user.id
  const url = new URL(request.url)
  const requested = parseRealtimeChannels(url.searchParams.get('channels'))
  const channels =
    requested.length > 0 ? requested : [userChannel(userId)]

  const { allowed, rejected } = await filterSubscribableChannelsAsync(
    userId,
    channels,
    [canSubscribeMapChannel],
  )

  if (allowed.length === 0) {
    return NextResponse.json(
      {
        error: 'No allowed channels',
        rejected,
        hint: `Allowed: ${userChannel(userId)} and authorized map:room:…:team:… channels`,
      },
      { status: 403 },
    )
  }

  if (rejected.length > 0) {
    return NextResponse.json(
      {
        error: 'Forbidden channels',
        rejected,
        hint: `Allowed: ${userChannel(userId)} and authorized map:room:…:team:… channels`,
      },
      { status: 403 },
    )
  }

  const port = getRealtimePort()
  const encoder = new TextEncoder()
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const unsubscribers: Array<() => void> = []

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Closed stream — cleanup below via cancel/abort.
        }
      }

      send(`: connected ${allowed.join(',')}\n\n`)

      for (const channel of allowed) {
        unsubscribers.push(
          port.subscribe(channel, (event) => {
            send(encodeSseEvent(event))
          }),
        )
      }

      heartbeat = setInterval(() => {
        send(`: ping ${Date.now()}\n\n`)
      }, HEARTBEAT_MS)

      request.signal.addEventListener('abort', () => {
        if (heartbeat) clearInterval(heartbeat)
        for (const unsub of unsubscribers) unsub()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      for (const unsub of unsubscribers) unsub()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
