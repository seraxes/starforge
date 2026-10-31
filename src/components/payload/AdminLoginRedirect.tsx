import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/core/auth'
import { loadCoreUserCmsAccess } from '@/core/cms-bridge'

/**
 * Payload `/admin/login` beforeLogin hook.
 * With local strategy disabled there is no email/password form — send people
 * through core `/login`, or deny when signed in without cms_access.
 */
export default async function AdminLoginRedirect() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    redirect('/login?next=/admin')
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  if (!access?.cmsAccess || access.banned) {
    redirect('/?notice=cms-denied')
  }

  // Signed in with CMS rights — strategy should already auth; land on dashboard.
  redirect('/admin')
}
