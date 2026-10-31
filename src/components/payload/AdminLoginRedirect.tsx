import { redirect } from 'next/navigation'

/**
 * Last-resort Payload login view override.
 * Middleware should already redirect `/admin/login` away; this ensures the
 * stock LoginView never paints a password form if a view override is used.
 */
export default function AdminLoginRedirect() {
  redirect('/api/cms/exchange?next=/admin')
}
