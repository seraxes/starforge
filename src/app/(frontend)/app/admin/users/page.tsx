import React from 'react'
import Link from 'next/link'
import { desc } from 'drizzle-orm'

import {
  ensureDefaultUserGroupsSeeded,
  listGroupIdsByUserIds,
  listUserGroupOptions,
} from '@/core/acl'
import { db, sfUsers } from '@/core/db'
import { normalizeAppRole } from '@/core/auth/permissions'
import { UsersAdminTable } from './users-admin-table'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  await ensureDefaultUserGroupsSeeded()

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
    .orderBy(desc(sfUsers.createdAt))

  const groupMap = await listGroupIdsByUserIds(rows.map((r) => r.id))
  const groupOptions = await listUserGroupOptions()

  const users = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeAppRole(row.role),
    cmsAccess: Boolean(row.cmsAccess),
    banned: Boolean(row.banned),
    banReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
    groupIds: groupMap.get(row.id) ?? [],
  }))

  return (
    <section className="admin-section">
      <h2>App users</h2>
      <p className="lede admin-lede">
        List core accounts (`sf_users`), set <code>admin</code> / <code>member</code>, assign{' '}
        <Link href="/app/admin/users/groups">groups</Link>, edit the{' '}
        <Link href="/app/admin/users/acl">ACL</Link> stub, toggle <strong>CMS access</strong>{' '}
        (Content CMS at <code>/admin</code> via the same Better Auth login), or disable (ban).
        Product members without CMS access are never pushed into Payload.
      </p>
      <UsersAdminTable users={users} groupOptions={groupOptions} />
    </section>
  )
}
