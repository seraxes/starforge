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
  description: 'Assign admin permissions to user groups.',
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
        One model: <strong>groups</strong> hold permissions here; the same groups (plus Public /
        Registered tags) control who can <em>see</em> Nav items and layout particles. There is no
        separate Access Level table — manage membership under{' '}
        <Link href="/app/admin/users/groups">Groups</Link>. Global app admins still open all Core
        admin today; this matrix is the stub for later enforcement.
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
