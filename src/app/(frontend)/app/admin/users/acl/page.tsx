import React from 'react'
import Link from 'next/link'

import {
  ACL_ADMIN_RESOURCES,
  ensureDefaultUserGroupsSeeded,
  getGroupAclMatrix,
  listUserGroups,
} from '@/core/acl'

import { AclMatrixManager } from './acl-matrix-manager'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'ACL — Starforge',
  description: 'Group-keyed ACL stub and Joomla-style view access overview.',
}

export default async function AdminAclPage() {
  await ensureDefaultUserGroupsSeeded()
  const groups = await listUserGroups()
  const matrices = await Promise.all(
    groups.map(async (g) => ({
      groupId: g.id,
      groupLabel: g.label,
      rows: await getGroupAclMatrix(g.id),
    })),
  )

  return (
    <section className="admin-section">
      <h2>ACL</h2>
      <p className="lede admin-lede">
        Joomla-style direction: view access tags on{' '}
        <Link href="/app/admin/nav">menu items</Link> and layout particles; admin-area grants keyed
        by <Link href="/app/admin/users/groups">groups</Link>. Global app admins still open all Core
        admin today — this matrix is the foundation stub.
      </p>

      <AclMatrixManager
        resources={ACL_ADMIN_RESOURCES.map((r) => ({ key: r.key, label: r.label }))}
        groups={matrices.map((m) => ({
          id: m.groupId,
          label: m.groupLabel,
          allowed: m.rows.filter((r) => r.allowed).map((r) => r.resource),
        }))}
      />
    </section>
  )
}
