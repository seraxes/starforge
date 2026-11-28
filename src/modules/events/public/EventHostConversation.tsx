/**
 * Soft-mount Social’s shared comment controls on the public event detail page.
 * Social off → render nothing (no error). Uses loadModuleDoor — no Social import.
 */

import React from 'react'

type Props = {
  eventId: string
  /** Locale-prefixed public path for revalidatePath after writes. */
  hostPath: string
}

export async function EventHostConversation({ eventId, hostPath }: Props) {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('social-api-server')
    const Mount = door?.HostConversationMount as
      | ((props: {
          hostModule: 'product:events'
          hostId: string
          hostPath?: string | null
          viewerAlreadyCanView?: boolean
          className?: string
          heading?: string
        }) => Promise<React.ReactNode> | React.ReactNode)
      | undefined
    if (typeof Mount !== 'function') return null
    return await Mount({
      hostModule: 'product:events',
      hostId: eventId,
      hostPath,
      viewerAlreadyCanView: true,
      className: 'sf-event-conversation',
      heading: 'Comments',
    })
  } catch {
    return null
  }
}
