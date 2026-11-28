import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** Former Integrations topic — renamed to Security (SF-116). */
export default function AdminSettingsIntegrationsRedirectPage() {
  redirect('/admin/settings/security')
}
