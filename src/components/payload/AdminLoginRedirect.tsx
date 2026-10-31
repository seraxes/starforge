import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/core/auth'
import { loadCoreUserCmsAccess } from '@/core/cms-bridge'

/**
 * Replaces Payload `/admin/login` — never show email/password.
 * Send through JWT exchange so the admin UI gets payload-token.
 */
export default async function AdminLoginRedirect() {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  })

  if (!session?.user?.id) {
    redirect('/login?next=/admin')
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  if (!access?.cmsAccess || access.banned) {
    redirect('/?notice=cms-denied')
  }

  redirect('/api/cms/exchange?next=/admin')
}
