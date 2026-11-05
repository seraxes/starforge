import React from 'react'
import Link from 'next/link'

import {
  ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS,
  ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS,
  getSiteSettings,
} from '@/core/settings'
import { AdminUxForm } from './admin-ux-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Admin UX — Starforge',
  description: 'Core admin autosave debounce and related UX controls.',
}

export default async function AdminSettingsAdminUxPage() {
  const settings = await getSiteSettings()

  return (
    <section className="admin-section">
      <h2>Settings — Admin UX</h2>
      <p className="lede admin-lede">
        Core <code>/admin</code> text-field autosave delay ({ADMIN_AUTOSAVE_DEBOUNCE_MIN_MS}–
        {ADMIN_AUTOSAVE_DEBOUNCE_MAX_MS} ms). Blur still saves immediately. Modules on/off:{' '}
        <Link href="/admin/settings">Modules</Link>.
      </p>
      <AdminUxForm adminAutosaveDebounceMs={settings.adminAutosaveDebounceMs} />
    </section>
  )
}
