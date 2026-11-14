import React from 'react'
import { Logout } from '@payloadcms/ui'
import { NavHamburger, NavWrapper } from '@payloadcms/next/client'
import type { ServerProps } from 'payload'

import { AdminSidebarAccount } from '@/components/admin/AdminSidebarAccount'
import { AdminSidebarBrand } from '@/components/admin/AdminSidebarBrand'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import {
  buildAdminNavGroups,
  resolveEnabledAdminNavModuleIds,
} from '@/core/admin-nav'
import { userIsDeveloperAdmin } from '@/core/auth/admin'
import { getAdminSession } from '@/core/auth/admin-session'
import { getActiveAdminTheme } from '@/core/admin-theme'
import {
  MODULE_IDS,
  ensureSiteSettingsDefaults,
  isCatalogModuleEnabled,
} from '@/core/settings'

const baseClass = 'nav'

/**
 * Payload admin left nav — same tree as Core `/admin`.
 * Replaces DefaultNav so CMS collections sit under the shared CMS accordion
 * instead of a Payload-only IA.
 */
export default async function StarforgeAdminNav(props: ServerProps) {
  const { visibleEntities, user } = props
  const settings = await ensureSiteSettingsDefaults()
  const theme = getActiveAdminTheme()
  const enabledModuleIds = resolveEnabledAdminNavModuleIds(settings)
  const appSession = await getAdminSession()

  const groups = buildAdminNavGroups({
    surface: 'payload',
    flags: {
      nav: isCatalogModuleEnabled(settings, MODULE_IDS.primaryNav),
      layout: isCatalogModuleEnabled(settings, MODULE_IDS.layoutManager),
      pageSettings: isCatalogModuleEnabled(settings, MODULE_IDS.pageSettings),
      // Payload surface always shows CMS children the user can see.
      cms: true,
    },
    enabledModuleIds,
    developerAdmin: userIsDeveloperAdmin(appSession?.user),
    cmsVisibility: visibleEntities
      ? {
          collections: visibleEntities.collections,
          globals: visibleEntities.globals,
        }
      : null,
  })

  const email =
    user && typeof user === 'object' && 'email' in user && typeof user.email === 'string'
      ? user.email
      : null
  const name =
    user && typeof user === 'object' && 'name' in user && typeof user.name === 'string'
      ? user.name
      : null
  const image =
    user && typeof user === 'object' && 'image' in user && typeof user.image === 'string'
      ? user.image
      : null
  // Prefer Core user id (Better Auth) — Payload `users.id` is a separate CMS row.
  const coreUserId =
    user &&
    typeof user === 'object' &&
    'coreUserId' in user &&
    typeof user.coreUserId === 'string' &&
    user.coreUserId.trim()
      ? user.coreUserId.trim()
      : null

  return (
    <NavWrapper baseClass={baseClass}>
      <div
        className={`${baseClass}__wrap sf-payload-admin-nav`}
        data-sf-admin-theme={theme.dataAttr}
      >
        <AdminSidebarNav
          variant="embedded"
          groups={groups}
          brand={<AdminSidebarBrand surface="payload" />}
          who={
            email && coreUserId ? (
              <AdminSidebarAccount
                userId={coreUserId}
                email={email}
                name={name}
                image={image}
              />
            ) : null
          }
        />
        <div className={`${baseClass}__controls`}>
          <Logout />
        </div>
      </div>
      <div className={`${baseClass}__header`}>
        <div className={`${baseClass}__header-content`}>
          <NavHamburger baseClass={baseClass} />
        </div>
      </div>
    </NavWrapper>
  )
}
