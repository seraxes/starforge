import React from 'react'
import { getLocale, getTranslations } from 'next-intl/server'

import { AccountMenu } from '@/components/AccountMenu'
import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import type { StarforgeModule } from '../types'
import { readAccountMenuConfig } from './config'

function accountInitial(name: string, email: string): string {
  const source = name.trim() || email.trim()
  const ch = Array.from(source)[0]
  return ch ? ch.toLocaleUpperCase() : ''
}

/**
 * Account menu particle. Chrome strings come from the Auth message catalog
 * for the current locale. Layout outlines are not copied per language.
 * Avatar is resolved from Profiles when that pack is installed and enabled.
 */
export const accountMenuModule: StarforgeModule = {
  id: 'account-menu',
  name: 'Account menu',
  description:
    'Header account button. Shows the profile photo when one exists, otherwise the first letter of the name. Menu labels follow the current language.',
  builtin: true,
  defaultWidth: 15,
  render: async ({ settings, slot }) => {
    const cfg = readAccountMenuConfig(slot.config)
    const locale = await getLocale()
    const t = await getTranslations({ locale, namespace: 'Auth' })
    const session = await getAppSession()
    const user = session?.user as
      | { id?: string; email?: string | null; name?: string | null }
      | undefined
    const signedIn = Boolean(user?.id)
    let displayName = (user?.name ?? '').trim()
    const email = (user?.email ?? '').trim()
    let avatarUrl = ''

    if (signedIn && user?.id) {
      try {
        const { loadModuleDoor } = await import('@/generated/module-registry.server')
        const door = await loadModuleDoor('profiles-api-server')
        const isProfilesModuleEnabled = door?.isProfilesModuleEnabled as
          | (() => Promise<boolean>)
          | undefined
        const getPersona = door?.getPersona as
          | ((
              userId: string,
              viewer: Awaited<ReturnType<typeof getAccessViewer>>,
            ) => Promise<{ displayName?: string; avatarMediaId?: string | null } | null>)
          | undefined
        const personaMediaSrc = door?.personaMediaSrc as
          | ((mediaId: string | null | undefined) => string)
          | undefined
        if (isProfilesModuleEnabled && getPersona && personaMediaSrc && (await isProfilesModuleEnabled())) {
          const viewer = await getAccessViewer()
          const persona = await getPersona(user.id, viewer)
          if (persona?.displayName?.trim()) displayName = persona.displayName.trim()
          if (persona?.avatarMediaId) avatarUrl = personaMediaSrc(persona.avatarMediaId)
        }
      } catch {
        // Profiles pack absent from this install.
      }
    }

    const profilesOn = isCatalogModuleEnabled(settings, MODULE_IDS.profiles)
    const subscriptionsOn = isCatalogModuleEnabled(settings, MODULE_IDS.subscriptions)
    const links = signedIn
      ? [
          ...(profilesOn ? [{ href: '/account/profile', label: t('profile') }] : []),
          { href: '/account/security', label: t('accountSecurity') },
          ...(subscriptionsOn
            ? [{ href: '/account/subscriptions', label: t('mySubscriptions') }]
            : []),
        ]
      : [
          { href: '/login', label: t('signIn') },
          ...(settings.features.registration
            ? [{ href: '/register', label: t('createAccount') }]
            : []),
          ...(subscriptionsOn ? [{ href: '/plans', label: t('plans') }] : []),
        ]

    return (
      <div data-sf-particle="account-menu" data-sf-slot={slot.id}>
        <AccountMenu
          locale={locale}
          signedIn={signedIn}
          initial={accountInitial(displayName, email)}
          avatarUrl={avatarUrl}
          avatarShape={cfg.avatarShape}
          avatarSize={cfg.avatarSize}
          menuLabel={t('accountMenu')}
          links={links}
          signOutLabel={t('signOut')}
        />
      </div>
    )
  },
}
