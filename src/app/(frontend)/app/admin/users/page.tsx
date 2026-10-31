import React from 'react'
import { desc } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { normalizeAppRole } from '@/core/auth/permissions'
import { UsersAdminTable } from './users-admin-table'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const rows = await db
    .select({
      id: sfUsers.id,
      name: sfUsers.name,
      email: sfUsers.email,
      role: sfUsers.role,
      banned: sfUsers.banned,
      banReason: sfUsers.banReason,
      createdAt: sfUsers.createdAt,
    })
    .from(sfUsers)
    .orderBy(desc(sfUsers.createdAt))

  const users = rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: normalizeAppRole(row.role),
    banned: Boolean(row.banned),
    banReason: row.banReason,
    createdAt: row.createdAt.toISOString(),
  }))

  return (
    <section className="admin-section">
      <h2>App users</h2>
      <p className="lede admin-lede">
        List core accounts (`sf_users`), set <code>admin</code> / <code>member</code>, or disable
        (ban). These are not Payload CMS editors.
      </p>
      <UsersAdminTable users={users} />
    </section>
  )
}
