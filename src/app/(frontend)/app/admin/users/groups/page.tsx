import React from 'react'
import Link from 'next/link'

import { ensureDefaultUserGroupsSeeded, listUserGroups } from '@/core/acl'

import { GroupsManager } from './groups-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'User groups — Starforge',
  description: 'Create and manage Starforge user groups and ACL stubs.',
}

export default async function AdminUserGroupsPage() {
  await ensureDefaultUserGroupsSeeded()
  const groups = await listUserGroups()

  return (
    <section className="admin-section">
      <h2>User groups</h2>
      <p className="lede admin-lede">
        Groups under <Link href="/app/admin/users">Users</Link> — create, rename, delete, and
        assign members. Nav items can target <code>group:&lt;id&gt;</code>; the ACL matrix on each
        group is a stub foundation for admin areas (global app admins still open all Core admin
        today).
      </p>
      <GroupsManager
        groups={groups.map((g) => ({
          id: g.id,
          label: g.label,
          description: g.description,
          memberCount: g.memberCount,
          updatedAt: g.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
