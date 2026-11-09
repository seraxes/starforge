import React from 'react'
import Link from 'next/link'

import {
  MODULE_IDS,
  getSiteSettings,
  isCatalogModuleEnabled,
} from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { AuthSettingsForm } from './auth-settings-form'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Settings — Auth & registration — Starforge',
  description: 'Registration enable and auth site policy.',
}

export default async function AdminSettingsAuthPage() {
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const registrationEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.registration)

  return (
    <section className="admin-section">
      <h2>Settings — Auth & registration</h2>
      <p className="lede admin-lede">
        Public registration and auth option policy. Forgot password, magic link, email OTP, and
        2FA use Better Auth + Mailer (outbound email under{' '}
        <Link href="/admin/site-chrome">Chrome</Link>). The same registration gate appears
        as <code>product:registration</code> under{' '}
        <Link href="/admin/settings">Modules</Link>.
      </p>
      <AuthSettingsForm
        registrationEnabled={registrationEnabled}
        authOptions={{
          forgotPasswordEnabled: chrome.authForgotPasswordEnabled,
          forgotUsernameEnabled: chrome.authForgotUsernameEnabled,
          magicLinkEnabled: chrome.authMagicLinkEnabled,
          emailOtpEnabled: chrome.authEmailOtpEnabled,
          rememberMeEnabled: chrome.authRememberMeEnabled,
          twoFactorEnabled: chrome.authTwoFactorEnabled,
        }}
        successUrls={{
          postLoginUrl: chrome.authPostLoginUrl,
          postRegisterUrl: chrome.authPostRegisterUrl,
          postLogoutUrl: chrome.authPostLogoutUrl,
        }}
      />
    </section>
  )
}
