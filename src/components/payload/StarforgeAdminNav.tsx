import React from 'react'
import { NavHamburger, NavWrapper } from '@payloadcms/next/client'
import type { ServerProps } from 'payload'

import { AdminSidebarAccount } from '@/components/admin/AdminSidebarAccount'
import { AdminSidebarBrand } from '@/components/admin/AdminSidebarBrand'
import { AdminSidebarNav } from '@/components/admin/AdminSidebarNav'
import {
  buildAdminNavGroups,
  filterAdminNavByAcl,
  resolveEnabledAdminNavModuleIds,
} from '@/core/admin-nav'
import {
  getAdminAccessViewer,
  listViewerAllowedAdminResources,
  type AclAdminResourceKey,
} from '@/core/acl'
import { roleFromUser, userIsDeveloperAdmin } from '@/core/auth/admin'
import { getAdminSession } from '@/core/auth/admin-session'
import { getActiveAdminTheme } from '@/core/admin-theme'
import {
  MODULE_IDS,
  ensureSiteSettingsDefaults,
  isCatalogModuleEnabled,
} from '@/core/settings'

const baseClass = 'nav'

/**
 * Payload admin left nav — same tree, account card, and ACL prune as Core `/admin`.
 * Replaces DefaultNav so CMS collections sit under the shared CMS accordion
 * instead of a Payload-only IA. Sign-out lives on the account card (no Payload Logout).
 */
export default async function StarforgeAdminNav(props: ServerProps) {
  const { visibleEntities } = props
  const settings = await ensureSiteSettingsDefaults()
  const theme = getActiveAdminTheme()
  const enabledModuleIds = resolveEnabledAdminNavModuleIds(settings)
  const appSession = await getAdminSession()
  const viewer = await getAdminAccessViewer()
  // Same prune as Core layout — allowed set only (do not path-gate on /cms/admin).
  const allowed: ReadonlySet<AclAdminResourceKey> = viewer.isAppAdmin
    ? new Set<AclAdminResourceKey>()
    : await listViewerAllowedAdminResources(viewer)

  const groups = filterAdminNavByAcl(
    buildAdminNavGroups({
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
    }),
    viewer.isAppAdmin,
    allowed,
  )

  // Prefer Core Better Auth session for the account card (name + role), same as `/admin`.
  const sessionUser = appSession?.user
  const email =
    (sessionUser?.email && String(sessionUser.email).trim()) || null
  const name =
    sessionUser && 'name' in sessionUser && typeof sessionUser.name === 'string'
      ? sessionUser.name
      : null
  const image =
    sessionUser && 'image' in sessionUser && typeof sessionUser.image === 'string'
      ? sessionUser.image
      : null
  const coreUserId = sessionUser?.id?.trim() || null
  const role = sessionUser ? roleFromUser(sessionUser) : null

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
                role={role}
              />
            ) : null
          }
        />
        {/* Account card owns sign-out — hide empty Payload controls strip. */}
        <div className={`${baseClass}__controls`} hidden aria-hidden="true" />
      </div>
      <div className={`${baseClass}__header`}>
        <div className={`${baseClass}__header-content`}>
          <NavHamburger baseClass={baseClass} />
        </div>
      </div>
    </NavWrapper>
  )
}
