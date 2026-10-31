import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/core/auth'
import { loadCoreUserCmsAccess } from '@/core/cms-bridge'

/**
 * Replaces Payload's `/admin/login` view.
 * Local strategy is disabled — never show an email/password form here.
 * Send people through core Better Auth, or deny when signed in without cms_access.
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

  // Session + CMS rights exist — strategy should auth on /admin.
  redirect('/admin')
}
