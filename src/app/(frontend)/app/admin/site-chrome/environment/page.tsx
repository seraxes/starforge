import React from 'react'
import Link from 'next/link'

import { requireDeveloperAdmin, userIsDeveloperAdmin } from '@/core/auth/admin'
import { getAppSession } from '@/core/auth/session'
import { loadEnvEditorSnapshot, readEnvEditorGate } from '@/core/env-editor/server'

import { EnvironmentEditorForm } from './environment-editor-form'
import { EnvironmentGateForm } from './environment-gate-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Environment — Starforge',
  description:
    'Gated editor for gitignored .env.local overlay — secrets never stored in Postgres.',
}

export default async function AdminEnvironmentPage() {
  const session = await getAppSession()
  const isDevAdmin = userIsDeveloperAdmin(session?.user)

  if (!isDevAdmin) {
    return (
      <section className="admin-section">
        <h2>Environment</h2>
        <p className="lede admin-lede">
          Developer-admin only (same gate as script-capable Page Settings). Ask a platform owner to
          add your email to <code>STARFORGE_DEVELOPER_ADMIN_EMAILS</code>. An empty list grants
          nobody in production (fail-closed); outside production all app admins qualify.
        </p>
        <p>
          <Link href="/app/admin/site-chrome">← Chrome</Link>
        </p>
      </section>
    )
  }

  // Ensure bootstrap promotion already ran in layout; re-check developer gate.
  await requireDeveloperAdmin()

  const [gate, snapshot] = await Promise.all([readEnvEditorGate(), loadEnvEditorSnapshot()])
  const email = session?.user?.email ?? ''

  return (
    <section className="admin-section">
      <h2>Environment</h2>
      <p className="lede admin-lede">
        Joomla-style env overlay for local/ops — writes <code>.env.local</code> (gitignored), not
        Chrome / Settings / Postgres. Captcha and mail <em>policy</em> stay under{' '}
        <Link href="/app/admin/site-chrome">Chrome</Link>; secret <em>values</em> live here.
        Restart the Node process after writes so Next reloads env.
      </p>

      {!gate.unlocked ? (
        <EnvironmentGateForm email={email} />
      ) : (
        <EnvironmentEditorForm snapshot={snapshot} expiresAt={gate.expiresAt} />
      )}
    </section>
  )
}
