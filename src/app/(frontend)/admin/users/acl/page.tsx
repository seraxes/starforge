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
        One model: <strong>groups</strong> hold permissions here. <strong>View</strong> opens an
        area, <strong>Edit</strong> changes it, and <strong>Manage</strong> also covers delete,
        settings, and money. The same groups (plus Public / Registered tags) control who can{' '}
        <em>see</em> Navigation items and layout particles. There is no separate Access Level
        table — manage membership under <Link href="/admin/users/groups">Groups</Link>. Global app
        admins open every Core admin area. Other signed-in users open only areas granted to their
        groups.
      </p>

      <AclMatrixManager
        resources={ACL_ADMIN_RESOURCES.map((r) => ({ key: r.key, label: r.label }))}
        groups={matrices.map((m) => ({
          id: m.groupId,
          label: m.groupLabel,
          levels: Object.fromEntries(
            m.rows.filter((r) => r.level).map((r) => [r.resource, r.level as string]),
          ),
        }))}
      />
    </section>
  )
}
