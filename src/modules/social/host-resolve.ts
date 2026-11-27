/**
 * Resolve host pack view / moderate gates for conversation posts.
 * Calls Events / Pages public doors via loadModuleDoor — no static store/schema import.
 */

import 'server-only'

import type { HostConversationRecord } from './host-conversation'

type HostAccessFn = (hostId: string, viewerUserId: string | null) => Promise<boolean>
type HostModerateFn = (hostId: string, viewerUserId: string | null) => Promise<boolean>

async function loadEventsHostFns(): Promise<{
  mayAccess: HostAccessFn
  mayModerate: HostModerateFn
} | null> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('events-api')
    const mayAccess = door?.viewerMayAccessEventConversation as HostAccessFn | undefined
    const mayModerate = door?.viewerMayModerateEventConversation as
      | HostModerateFn
      | undefined
    if (typeof mayAccess !== 'function' || typeof mayModerate !== 'function') {
      return null
    }
    return { mayAccess, mayModerate }
  } catch {
    return null
  }
}

async function loadPagesHostFns(): Promise<{
  mayAccess: HostAccessFn
  mayModerate: HostModerateFn
} | null> {
  try {
    const { loadModuleDoor } = await import('@/generated/module-registry.server')
    const door = await loadModuleDoor('pages-api')
    const mayAccess = door?.viewerMayAccessPageConversation as HostAccessFn | undefined
    const mayModerate = door?.viewerMayModeratePageConversation as
      | HostModerateFn
      | undefined
    if (typeof mayAccess !== 'function' || typeof mayModerate !== 'function') {
      return null
    }
    return { mayAccess, mayModerate }
  } catch {
    return null
  }
}

async function loadHostFns(hostModule: string) {
  if (hostModule === 'product:events') return loadEventsHostFns()
  if (hostModule === 'product:pages') return loadPagesHostFns()
  return null
}

/** True when the host pack says this viewer may see the event / page. */
export async function resolveHostConversationCanView(
  conversation: HostConversationRecord,
  viewerUserId: string | null,
): Promise<boolean> {
  const fns = await loadHostFns(conversation.hostModule)
  if (!fns) return false
  try {
    return Boolean(await fns.mayAccess(conversation.hostId, viewerUserId))
  } catch (error) {
    console.error('[social] host conversation canView failed', error)
    return false
  }
}

/** True when the host pack says this viewer may moderate the thread. */
export async function resolveHostConversationCanModerate(
  conversation: HostConversationRecord,
  viewerUserId: string | null,
): Promise<boolean> {
  const id = viewerUserId?.trim() || null
  if (!id) return false
  const fns = await loadHostFns(conversation.hostModule)
  if (!fns) return false
  try {
    return Boolean(await fns.mayModerate(conversation.hostId, id))
  } catch (error) {
    console.error('[social] host conversation canModerate failed', error)
    return false
  }
}
