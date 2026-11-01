import React from 'react'
import Link from 'next/link'

import { ensureDefaultUserGroupsSeeded, listUserGroups } from '@/core/acl'

import { GroupsManager } from './groups-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'User groups — Starforge',
  description: 'Create and manage Starforge user groups.',
}

export default async function AdminUserGroupsPage() {
  await ensureDefaultUserGroupsSeeded()
  const groups = await listUserGroups()

  return (
    <section className="admin-section">
      <h2>User groups</h2>
      <p className="lede admin-lede">
        Create groups and assign members. The same groups are tagged on{' '}
        <Link href="/app/admin/nav">Nav</Link> / Layout items for viewing, and receive admin
        permissions under <Link href="/app/admin/users/acl">ACL</Link> — no separate Access Level
        entity.
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
