import React from 'react'
import Link from 'next/link'
import { and, desc, ilike, inArray, or } from 'drizzle-orm'

import { ensureDefaultUserGroupsSeeded } from '@/core/acl'
import { db, sfUsers } from '@/core/db'
import { normalizeAppRole } from '@/core/auth/permissions'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { UsersAdminTable, type AdminUserRow } from './users-admin-table'

export const dynamic = 'force-dynamic'

type Search = Promise<{ q?: string }>

export default async function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  await ensureDefaultUserGroupsSeeded()

  const site = await getSiteSettings()
  const profilesEnabled = isCatalogModuleEnabled(site, MODULE_IDS.profiles)
  const params = await searchParams
  const q = (params.q ?? '').trim().slice(0, 100)

  const users = profilesEnabled
    ? await loadUsersWithProfiles(q)
    : await loadUsersCore(q)

  return (
    <section className="admin-section">
      <h2>Accounts</h2>
      <p className="lede admin-lede">
        Core accounts (`sf_users`): open a member to edit identity, role,{' '}
        <Link href="/admin/users/groups">groups</Link>, CMS access, or disable. Permissions →{' '}
        <Link href="/admin/users/acl">ACL</Link>
        {profilesEnabled ? (
          <>
            . Persona fields live on the account&apos;s Profile pane (
            <Link href="/admin/profiles/settings">Profiles settings</Link>).
          </>
        ) : (
          <>.</>
        )}
      </p>
      <UsersAdminTable users={users} q={q} profilesEnabled={profilesEnabled} />
    </section>
  )
}

async function loadUsersCore(q: string): Promise<AdminUserRow[]> {
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null
  const conditions = like
    ? [or(ilike(sfUsers.email, like), ilike(sfUsers.name, like))]
    : []

  const rows = await db
    .select({
      id: sfUsers.id,
      name: sfUsers.name,
      email: sfUsers.email,
      role: sfUsers.role,
      cmsAccess: sfUsers.cmsAccess,
      banned: sfUsers.banned,
      banReason: sfUsers.banReason,
      createdAt: sfUsers.createdAt,
    })
    .from(sfUsers)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(sfUsers.createdAt))
    .limit(500)

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeAppRole(row.role),
    cmsAccess: Boolean(row.cmsAccess),
    banned: Boolean(row.banned),
    banReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
    groupIds: [],
  }))
}

async function loadUsersWithProfiles(q: string): Promise<AdminUserRow[]> {
  const { listProfileDirectory } = await import('@/modules/profiles/store')
  const rows = await listProfileDirectory({ q, status: 'all', limit: 500 })
  const ids = rows.map((r) => r.userId)
  const accounts =
    ids.length > 0
      ? await db
          .select({
            id: sfUsers.id,
            name: sfUsers.name,
            cmsAccess: sfUsers.cmsAccess,
            banReason: sfUsers.banReason,
            createdAt: sfUsers.createdAt,
          })
          .from(sfUsers)
          .where(inArray(sfUsers.id, ids))
      : []
  const byId = new Map(accounts.map((a) => [a.id, a]))

  return rows.map((row) => {
    const acc = byId.get(row.userId)
    return {
      id: row.userId,
      name: acc?.name || row.userName || row.displayName,
      email: row.email,
      role: normalizeAppRole(row.role),
      cmsAccess: Boolean(acc?.cmsAccess),
      banned: row.banned,
      banReason: acc?.banReason ?? null,
      createdAt: (acc?.createdAt ?? row.updatedAt ?? new Date()).toISOString(),
      groupIds: [],
      handle: row.handle || null,
      profileStatus: row.hasProfile ? row.status : null,
      hasProfile: row.hasProfile,
      completeness: row.hasProfile ? row.completeness : null,
    }
  })
}
