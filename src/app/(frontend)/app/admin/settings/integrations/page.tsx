import { redirect } from 'next/navigation'

/** Former Integrations topic — renamed to Security (SF-116). */
export default function AdminSettingsIntegrationsRedirectPage() {
  redirect('/app/admin/settings/security')
}
