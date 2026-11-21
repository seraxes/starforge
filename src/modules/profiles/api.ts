/**
 * product:profiles client door.
 *
 *   import { ProfileEditor } from '@/modules/profiles/api'
 *
 * Server reads stay in `api.server`. This file does not import `server-only`.
 * Admin account pages pass `saveProfileAdminAction` / `setProfileStatusAction`
 * into client editors from a Server Component.
 */

export { ProfileEditor } from './components/ProfileEditor'
export { AccountNav } from './public/AccountNav'
export type { AccountNavTab } from './public/AccountNav'
export { saveProfileAdminAction, setProfileStatusAction } from './actions'
export type { Persona, ProfilesActionState } from './types'
