import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'

import {
  ensureDefaultUserGroupsSeeded,
  listGroupIdsByUserIds,
  listUserGroupOptions,
} from '@/core/acl'
import { VISITORS_GROUP_ID } from '@/core/acl/nav-access'
import { normalizeAppRole } from '@/core/auth/permissions'
import { db, sfUsers } from '@/core/db'
import { getEnabledPublicLocaleEntries } from '@/core/i18n/enabled'
import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { UserAccountPanel } from '../user-account-panel'
import { UserProfileStatusForm } from '../user-profile-status-form'
import { UserRetentionPanel } from '../user-retention-panel'

export const dynamic = 'force-dynamic'

type Params = Promise<{ userId: string }>

export default async function AdminUserDetailPage({ params }: { params: Params }) {
  await ensureDefaultUserGroupsSeeded()

  const { userId: rawId } = await params
  const userId = (rawId || '').trim()
  if (!userId) notFound()

  const [row] = await db
    .select({
      id: sfUsers.id,
      name: sfUsers.name,
      email: sfUsers.email,
      role: sfUsers.role,
      cmsAccess: sfUsers.cmsAccess,
      banned: sfUsers.banned,
      banReason: sfUsers.banReason,
      hiddenAt: sfUsers.hiddenAt,
      purgeEligibleAt: sfUsers.purgeEligibleAt,
      legalHold: sfUsers.legalHold,
      createdAt: sfUsers.createdAt,
    })
    .from(sfUsers)
    .where(eq(sfUsers.id, userId))
    .limit(1)
  if (!row) notFound()

  const [groupMap, groupOptions, site] = await Promise.all([
    listGroupIdsByUserIds([userId]),
    listUserGroupOptions(),
    getSiteSettings(),
  ])
  const profilesEnabled = isCatalogModuleEnabled(site, MODULE_IDS.profiles)

  const account = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeAppRole(row.role),
    cmsAccess: Boolean(row.cmsAccess),
    banned: Boolean(row.banned),
    banReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
    groupIds: groupMap.get(userId) ?? [],
  }

  return (
    <section className="admin-section admin-layouts-full">
      <p className="sf-events-editor-back">
        <Link href="/admin/users">← Accounts</Link>
      </p>
      <h2>{account.name || account.email}</h2>
      <p className="lede admin-lede">
        <code>{account.email}</code>
        {account.banned ? (
          <>
            {' '}
            · <span className="admin-badge admin-badge-warn">Disabled</span>
          </>
        ) : null}
      </p>

      <h3>Account</h3>
      <UserAccountPanel
        user={account}
        groupOptions={groupOptions.filter((group) => group.id !== VISITORS_GROUP_ID)}
      />

      <UserRetentionPanel
        userId={userId}
        hiddenAt={row.hiddenAt?.toISOString() ?? null}
        purgeEligibleAt={row.purgeEligibleAt?.toISOString() ?? null}
        legalHold={Boolean(row.legalHold)}
      />

      {profilesEnabled ? <UserProfileSection userId={userId} email={account.email} /> : null}
    </section>
  )
}

async function UserProfileSection({ userId, email }: { userId: string; email: string }) {
  const { loadModuleDoor } = await import('@/generated/module-registry.server')
  const [client, server] = await Promise.all([
    loadModuleDoor('profiles-api'),
    loadModuleDoor('profiles-api-server'),
  ])
  if (!client || !server) return null
  const ProfileEditor = client.ProfileEditor as React.ComponentType<{
    model: unknown
    action: (prev: unknown, formData: FormData) => Promise<unknown>
    chrome: 'admin'
    imagePicker: 'library'
    cancelHref: string
    includeUserId: boolean
    mapClientConfig: unknown
    viewHrefPrefix: string
  }>
  const saveProfileAdminAction = client.saveProfileAdminAction as (
    prev: unknown,
    formData: FormData,
  ) => Promise<unknown>
  const setProfileStatusAction = client.setProfileStatusAction as (prev: {
    ok?: boolean
    error?: string
  }, formData: FormData) => Promise<{ ok?: boolean; error?: string }>
  const buildEditorModel = server.buildEditorModel as (input: {
    record: { handle: string; status: string }
    email: string
    settings: unknown
    formConfig: unknown
    locales: Awaited<ReturnType<typeof getEnabledPublicLocaleEntries>>
    actor: 'admin'
  }) => unknown
  const ensureProfile = server.ensureProfile as (userId: string) => Promise<{
    handle: string
    status: string
  } | null>
  const loadProfilesModuleSettings = server.loadProfilesModuleSettings as () => Promise<{
    settings: unknown
    formConfig: unknown
  }>

  const site = await getSiteSettings()
  const mapsEnabled = isCatalogModuleEnabled(site, MODULE_IDS.maps)
  const [record, loaded, locales, mapClientConfig] = await Promise.all([
    ensureProfile(userId),
    loadProfilesModuleSettings(),
    getEnabledPublicLocaleEntries(),
    mapsEnabled ? getMapProvider().then((p) => p.clientConfig()) : Promise.resolve(null),
  ])
  if (!record) {
    return (
      <>
        <h3>Profile</h3>
        <p className="admin-empty">Could not provision a profile for this account.</p>
      </>
    )
  }

  const model = buildEditorModel({
    record,
    email,
    settings: loaded.settings,
    formConfig: loaded.formConfig,
    locales,
    actor: 'admin',
  })

  return (
    <>
      <h3 id="profile">
        Profile{' '}
        <span className="layout-muted">
          @{record.handle} · {record.status}
        </span>
      </h3>
      <p className="lede admin-lede">
        Persona fields from <Link href="/admin/forms/profile">Forms → Profile</Link>. Hide/unhide
        the public page without disabling the account.{' '}
        <Link href="/admin/profiles/settings">Profiles settings</Link>.
      </p>
      <UserProfileStatusForm
        userId={userId}
        status={record.status}
        handle={record.handle}
        action={setProfileStatusAction}
      />
      <ProfileEditor
        model={model}
        action={saveProfileAdminAction}
        chrome="admin"
        imagePicker="library"
        cancelHref="/admin/users"
        includeUserId
        mapClientConfig={mapClientConfig}
        viewHrefPrefix="/u/"
      />
    </>
  )
}
