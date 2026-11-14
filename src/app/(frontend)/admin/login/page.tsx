import React from 'react'
import { redirect } from 'next/navigation'

import { AuthWelcomePanel } from '@/components/AuthWelcomePanel'
import { parseLoginMode } from '@/app/(frontend)/(public)/[locale]/login/login-mode'
import { getActiveAdminTheme } from '@/core/admin-theme'
import {
  promoteSessionUserIfBootstrapAdmin,
  userIsAppAdmin,
} from '@/core/auth/admin'
import { getAdminSession } from '@/core/auth/admin-session'
import { isGoogleSignInConfigured } from '@/core/auth/google-sign-in'
import { listGroupIdsForUser, viewerMayEnterAdminShell } from '@/core/acl'
import type { AccessViewer } from '@/core/acl'
import { getAppSession } from '@/core/auth/session'
import { safeNextPath } from '@/core/auth/safe-next-path'
import { getSiteSettings } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Admin sign in — Starforge',
  description: 'Sign in to Starforge admin.',
  robots: { index: false, follow: false },
}

type Props = {
  searchParams: Promise<{ next?: string; reset?: string; error?: string; mode?: string }>
}

function resolveAdminLoginNext(raw: string | undefined): string {
  const next = safeNextPath(raw, '/admin')
  if (next.startsWith('/admin') || next.startsWith('/cms')) return next
  return '/admin'
}

/**
 * Same Better Auth login as public `/login`, under admin chrome colors.
 * Already-signed-in staff skip the form (admin or public session → mint → shell).
 */
export default async function AdminLoginPage({ searchParams }: Props) {
  const query = await searchParams
  const next = resolveAdminLoginNext(typeof query.next === 'string' ? query.next : undefined)
  const [adminSession, publicSession, settings, chrome] = await Promise.all([
    getAdminSession(),
    getAppSession(),
    getSiteSettings(),
    getSiteChrome(),
  ])
  const googleSignInEnabled = isGoogleSignInConfigured()
  const theme = getActiveAdminTheme()

  // Already in the admin shell cookie → go straight in.
  if (adminSession?.user) {
    redirect(next)
  }

  // Public Better Auth session only → mint staff cookie, then enter.
  if (publicSession?.user) {
    await promoteSessionUserIfBootstrapAdmin(publicSession.user)
    const viewer: AccessViewer = {
      userId: publicSession.user.id,
      isRegistered: true,
      isAppAdmin: userIsAppAdmin(publicSession.user),
      groupIds: await listGroupIdsForUser(publicSession.user.id),
    }
    if (!(await viewerMayEnterAdminShell(viewer))) {
      redirect('/?notice=admins-only')
    }
    redirect(`/api/auth/admin-session?next=${encodeURIComponent(next)}`)
  }

  return (
    <div className="admin-shell admin-login-shell" data-sf-admin-theme={theme.dataAttr}>
      <div className="auth-page admin-login-page">
        <AuthWelcomePanel
          siteName={settings.siteName}
          variant="page"
          title="Admin sign in"
          registrationEnabled={false}
          welcomeNote="Sign in with your Starforge admin account. Same credentials as the public login."
          next={next}
          resetSuccess={query.reset === '1'}
          magicError={query.error === 'magic_link'}
          googleError={query.error === 'google'}
          initialMode={parseLoginMode(query.mode)}
          showForm
          showAuthOptions={false}
          googleSignInEnabled={googleSignInEnabled}
          authOptions={{
            forgotPassword: chrome.authForgotPasswordEnabled,
            forgotUsername: chrome.authForgotUsernameEnabled,
            magicLink: chrome.authMagicLinkEnabled,
            emailOtp: chrome.authEmailOtpEnabled,
            rememberMe: chrome.authRememberMeEnabled,
            twoFactor: chrome.authTwoFactorEnabled,
            requireEmailVerification: chrome.authRequireEmailVerification,
          }}
        />
      </div>
    </div>
  )
}
