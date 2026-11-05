import { redirect } from 'next/navigation'

import { PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'

/**
 * Middleware should already redirect `/cms/admin/login` away; this ensures the
 * Payload login view never renders a password form.
 */
export default function AdminLoginRedirect() {
  redirect(`/api/cms/exchange?next=${PAYLOAD_ADMIN_BASE}`)
}
