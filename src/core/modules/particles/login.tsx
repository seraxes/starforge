import React from 'react'

import { AuthWelcomePanel } from '@/components/AuthWelcomePanel'
import { getAppSession } from '@/core/auth/session'

import type { StarforgeModule } from '../types'
import { readLoginConfig } from './config'

/**
 * Built-in Login / welcome particle — short welcome note + auth panel.
 * Place in Main (or aside), not in a branded Header/hero row.
 * Reuses the same public login/register look as `/login`.
 */
export const loginModule: StarforgeModule = {
  id: 'login',
  name: 'Login / Welcome',
  description:
    'Welcome note + sign-in panel (password / magic link / email code / stay signed in). Signed-in visitors get Account security (2FA). Keep out of branded heroes.',
  builtin: true,
  defaultWidth: 35,
  navViews: [
    { key: 'login', label: 'Sign in', href: '/login' },
    { key: 'forgot-password', label: 'Forgot password', href: '/forgot-password' },
    { key: 'forgot-username', label: 'Forgot login email', href: '/forgot-username' },
    { key: 'account-security', label: 'Account security', href: '/account/security' },
  ],
  render: async ({ settings, slot }) => {
    const cfg = readLoginConfig(slot.config)
    const session = await getAppSession()
    const user = session?.user as
      | { email?: string | null; name?: string | null }
      | undefined
    let siteName = settings.siteName
    try {
      const { getSiteChrome } = await import('@/core/site-chrome')
      const chrome = await getSiteChrome()
      if (chrome.siteName.trim()) siteName = chrome.siteName.trim()
    } catch {
      // Site Chrome table may be missing before db:core:push.
    }
    return (
      <div className="sf-login-particle">
        <AuthWelcomePanel
          siteName={siteName}
          variant="embed"
          welcomeNote={cfg.welcomeNote}
          registrationEnabled={settings.features.registration}
          signedIn={Boolean(session?.user)}
          userEmail={user?.email}
          userName={user?.name}
          showForm={cfg.showForm && !session?.user}
        />
      </div>
    )
  },
}
