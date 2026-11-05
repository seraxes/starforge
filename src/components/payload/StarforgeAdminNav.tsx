import React from 'react'
import Link from 'next/link'
import { Logout } from '@payloadcms/ui'
import { NavHamburger, NavWrapper } from '@payloadcms/next/client'
import type { ServerProps } from 'payload'

import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import { buildAdminNavGroups } from '@/core/admin-nav'
import { getActiveAdminTheme } from '@/core/admin-theme'
import {
  MODULE_IDS,
  getSiteSettings,
  isCatalogModuleEnabled,
} from '@/core/settings'

const baseClass = 'nav'

/**
 * Payload admin left nav — same tree as Core `/app/admin`.
 * Replaces DefaultNav so CMS collections sit under the shared CMS accordion
 * instead of a Payload-only IA.
 */
export default async function StarforgeAdminNav(props: ServerProps) {
  const { visibleEntities, user } = props
  const settings = await getSiteSettings()
  const theme = getActiveAdminTheme()

  const enabledModuleIds = new Set<string>()
  if (isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    enabledModuleIds.add(MODULE_IDS.forms)
  }
  if (isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    enabledModuleIds.add(MODULE_IDS.emailManager)
  }
  if (isCatalogModuleEnabled(settings, MODULE_IDS.redirects)) {
    enabledModuleIds.add(MODULE_IDS.redirects)
  }
  if (isCatalogModuleEnabled(settings, MODULE_IDS.media)) {
    enabledModuleIds.add(MODULE_IDS.media)
  }

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

  return (
    <NavWrapper baseClass={baseClass}>
      <div
        className={`${baseClass}__wrap sf-payload-admin-nav`}
        data-sf-admin-theme={theme.dataAttr}
      >
        <AdminSidebarNav
          variant="embedded"
          groups={groups}
          brand={
            <>
              <p className="brand">
                <Link href="/">Starforge</Link>
              </p>
              <p className="admin-sidebar-title">Starforge admin</p>
            </>
          }
          who={
            email ? (
              <p className="admin-who">
                Signed in as <strong>{email}</strong>
              </p>
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
