import React from 'react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Site settings — Performance — Starforge',
  description: 'Cache and performance controls (coming later).',
}

export default function AdminSettingsPerformancePage() {
  return (
    <section className="admin-section">
      <h2>Site settings — Performance</h2>
      <p className="lede admin-lede">
        Cache / Redis and related performance controls will land here later. Published content
        already uses a tagged cache path that can plug in Redis without rewriting the app. Other
        Site Settings topics: <Link href="/app/admin/settings">Modules</Link>,{' '}
        <Link href="/app/admin/settings/admin-ux">Admin UX</Link>,{' '}
        <Link href="/app/admin/settings/auth">Auth</Link>,{' '}
        <Link href="/app/admin/settings/integrations">Integrations</Link>.
      </p>
      <div className="settings-form settings-form-wide">
        <fieldset className="settings-fieldset">
          <legend>Cache</legend>
          <p className="settings-hint">
            No runtime toggles yet. Local can stay Next/in-memory; production Redis plugs into the
            same cache abstraction when hosting prep starts.
          </p>
        </fieldset>
      </div>
    </section>
  )
}
