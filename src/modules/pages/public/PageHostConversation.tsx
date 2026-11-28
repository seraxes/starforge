/**
 * Soft-mount Social’s shared comment controls on a public CMS page.
 * Social off → render nothing (no error). Uses loadModuleDoor — no Social import.
 */

import React from 'react'

type Props = {
  pageId: string
  /** Locale-prefixed public path for revalidatePath after writes. */
  hostPath: string
}

export async function PageHostConversation({ pageId, hostPath }: Props) {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('social-api-server')
    const Mount = door?.HostConversationMount as
      | ((props: {
          hostModule: 'product:pages'
          hostId: string
          hostPath?: string | null
          viewerAlreadyCanView?: boolean
          className?: string
          heading?: string
        }) => Promise<React.ReactNode> | React.ReactNode)
      | undefined
    if (typeof Mount !== 'function') return null
    return await Mount({
      hostModule: 'product:pages',
      hostId: pageId,
      hostPath,
      viewerAlreadyCanView: true,
      className: 'sf-page-conversation',
      heading: 'Comments',
    })
  } catch {
    return null
  }
}
