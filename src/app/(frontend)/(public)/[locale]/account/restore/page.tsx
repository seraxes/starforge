import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { isAccountPubliclyAbsent } from '@/core/auth/account-retention'
import { loadAccountRetentionState } from '@/core/auth/account-retention-store'
import { getAppSession } from '@/core/auth/session'
import { getSiteSettings } from '@/core/settings'

import { AccountRestorePanel } from './account-restore-panel'

export const metadata = {
  title: 'Restore account — Starforge',
  description: 'Restore your Starforge account during the retention wait.',
}

type Props = {
  searchParams: Promise<{ next?: string }>
}

export default async function AccountRestorePage({ searchParams }: Props) {
  const [session, settings, query] = await Promise.all([
    getAppSession(),
    getSiteSettings(),
    searchParams,
  ])
  if (!session?.user?.id) {
    redirect('/login?next=/account/restore')
  }

  const retention = await loadAccountRetentionState(session.user.id)
  if (!retention || !isAccountPubliclyAbsent(retention)) {
    const next = typeof query.next === 'string' && query.next.startsWith('/') ? query.next : '/'
    redirect(next)
  }

  return (
    <div className="auth-page">
      <div className="auth-card auth-card--wide">
        <p className="brand">{settings.siteName}</p>
        <h1>Restore your account</h1>
        <p className="lede">
          Your account is hidden and scheduled for removal after the retention wait. Restore it to
          clear the clock and show your content again. Public pages treat it as absent until then.
        </p>
        <AccountRestorePanel
          purgeEligibleAt={retention.purgeEligibleAt?.toISOString() ?? null}
          next={typeof query.next === 'string' ? query.next : undefined}
        />
        <p className="auth-switch">
          <Link href="/">Home</Link>
          {' · '}
          <Link href="/account/security">Account security</Link>
        </p>
      </div>
    </div>
  )
}
