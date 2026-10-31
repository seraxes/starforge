import { redirect, notFound } from 'next/navigation'

import { getAppSession } from '@/core/auth/session'
import { loadCoreUserCmsAccess, userHasCmsAccess } from '@/core/cms-bridge'
import { isDraftPreviewEnabled } from '@/core/settings'

export type DraftPreviewGate =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: 'feature-off' | 'signed-out' | 'no-cms-access' }

/**
 * Who may open `/preview/[slug]`:
 * - Feature toggle `draftPreview` must be on
 * - Signed-in core user with `cms_access` (admins get it by default)
 *
 * Non-throwing — safe for `generateMetadata`. Route handlers that need
 * login redirects should use `requireDraftPreviewAccess`.
 */
export async function resolveDraftPreviewAccess(): Promise<DraftPreviewGate> {
  if (!(await isDraftPreviewEnabled())) {
    return { ok: false, reason: 'feature-off' }
  }

  const session = await getAppSession()
  if (!session?.user?.id) {
    return { ok: false, reason: 'signed-out' }
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  if (!access || access.banned || !userHasCmsAccess(access)) {
    return { ok: false, reason: 'no-cms-access' }
  }

  return {
    ok: true,
    userId: access.id,
    email: access.email,
  }
}

/**
 * Enforce draft preview for a route. Redirects anonymous users to login;
 * 404 when the feature is off or the user lacks CMS access.
 */
export async function requireDraftPreviewAccess(returnPath: string): Promise<{
  userId: string
  email: string
}> {
  const gate = await resolveDraftPreviewAccess()

  if (gate.ok) {
    return { userId: gate.userId, email: gate.email }
  }

  if (gate.reason === 'signed-out') {
    redirect(`/login?next=${encodeURIComponent(returnPath)}`)
  }

  notFound()
}
