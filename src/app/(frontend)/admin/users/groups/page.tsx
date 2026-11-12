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
        Create groups and assign members. Nest a group under a parent — membership expands up the
        tree for <Link href="/admin/nav">Navigation</Link> / Layout tags and{' '}
        <Link href="/admin/users/acl">ACL</Link> grants. Direct membership stays what you assign
        here.
      </p>
      <GroupsManager
        groups={groups.map((g) => ({
          id: g.id,
          label: g.label,
          description: g.description,
          parentId: g.parentId,
          depth: g.depth,
          memberCount: g.memberCount,
          updatedAt: g.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
