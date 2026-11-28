import React from 'react'
import { getLocale, getTranslations } from 'next-intl/server'

import { AccountMenu, type AccountMenuLink } from '@/components/AccountMenu'
import { getAccessViewer } from '@/core/acl/access'
import { tagMatchesViewer } from '@/core/acl/nav-access'
import type { AccessViewer } from '@/core/acl/types'
import { getAppSession } from '@/core/auth/session'
import {
  ensureAccountNavMenuSeeded,
  resolveNavMenuItems,
  type ResolvedNavItem,
} from '@/core/nav'

import type { StarforgeModule } from '../types'
import { readAccountMenuConfig } from './config'

function accountInitial(name: string, email: string): string {
  const source = name.trim() || email.trim()
  const ch = Array.from(source)[0]
  return ch ? ch.toLocaleUpperCase() : ''
}

/**
 * Top-level items the viewer is allowed to see.
 * Does not use the app-admin nav bypass, so a signed-in admin still gets the
 * registered rows rather than the signed-out ones.
 */
function visibleAccountLinks(items: ResolvedNavItem[], viewer: AccessViewer): AccountMenuLink[] {
  const links: AccountMenuLink[] = []
  for (const item of items) {
    const tags = item.accessTags && item.accessTags.length > 0 ? item.accessTags : ['public']
    if (!tags.some((tag) => tagMatchesViewer(tag, viewer))) continue
    const href = item.href?.trim() ?? ''
    const label = item.label?.trim() ?? ''
    if (!href || !label) continue
    links.push({ href, label })
  }
  return links
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
    let handle = ''

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
            ) => Promise<{
              displayName?: string
              avatarMediaId?: string | null
              handle?: string
            } | null>)
          | undefined
        const personaMediaSrc = door?.personaMediaSrc as
          | ((mediaId: string | null | undefined) => string)
          | undefined
        if (isProfilesModuleEnabled && getPersona && personaMediaSrc && (await isProfilesModuleEnabled())) {
          const viewer = await getAccessViewer()
          const persona = await getPersona(user.id, viewer)
          if (persona?.displayName?.trim()) displayName = persona.displayName.trim()
          if (persona?.handle?.trim()) handle = persona.handle.trim()
          if (persona?.avatarMediaId) avatarUrl = personaMediaSrc(persona.avatarMediaId)
        }
      } catch {
        // Profiles pack absent from this install.
      }
    }

    const menuId = (cfg.menuId ?? '').trim()
    let links: AccountMenuLink[] = []
    try {
      await ensureAccountNavMenuSeeded()
      const resolved = await resolveNavMenuItems(menuId, settings, {
        fallbackToPrimary: false,
      })
      const viewer = await getAccessViewer()
      links = visibleAccountLinks(resolved, viewer)
    } catch {
      links = []
    }

    const accountName = displayName || email || t('accountMenu')
    let identityHref = '/feed'
    if (handle) {
      try {
        const { loadModuleDoor } = await import('@/generated/module-registry.server')
        const social = await loadModuleDoor('social-api')
        const memberFeedHref = social?.memberFeedHref as ((memberHandle: string) => string) | undefined
        identityHref = memberFeedHref
          ? memberFeedHref(handle)
          : `/feed/${encodeURIComponent(handle)}`
      } catch {
        identityHref = `/feed/${encodeURIComponent(handle)}`
      }
    }

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
          identity={
            signedIn
              ? {
                  href: identityHref,
                  name: accountName,
                  avatarUrl,
                  initial: accountInitial(displayName, email),
                }
              : null
          }
          pageIdentities={[]}
        />
      </div>
    )
  },
}
