import React from 'react'
import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { notFound } from 'next/navigation'

import {
  getGroupAclMatrix,
  getUserGroup,
  listGroupMembers,
} from '@/core/acl'
import { db, sfUsers } from '@/core/db'
import { normalizeAppRole } from '@/core/auth/permissions'

import { GroupDetailManager } from './group-detail-manager'

export const dynamic = 'force-dynamic'

type Args = {
  params: Promise<{ groupId: string }>
}

export async function generateMetadata({ params }: Args) {
  const { groupId } = await params
  const group = await getUserGroup(decodeURIComponent(groupId))
  return {
    title: group ? `${group.label} — Groups — Starforge` : 'Group — Starforge',
  }
}

export default async function AdminUserGroupDetailPage({ params }: Args) {
  const { groupId: rawId } = await params
  const groupId = decodeURIComponent(rawId)
  const group = await getUserGroup(groupId)
  if (!group) notFound()

  const [members, matrix, allUsers] = await Promise.all([
    listGroupMembers(group.id),
    getGroupAclMatrix(group.id),
    db
      .select({
        id: sfUsers.id,
        name: sfUsers.name,
        email: sfUsers.email,
        role: sfUsers.role,
      })
      .from(sfUsers)
      .orderBy(desc(sfUsers.createdAt)),
  ])

  const memberIds = new Set(members.map((m) => m.userId))
  const candidates = allUsers
    .filter((u) => !memberIds.has(u.id))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: normalizeAppRole(u.role),
    }))

  return (
    <section className="admin-section">
      <h2>
        {group.label}{' '}
        <code className="admin-code-inline">{group.id}</code>
      </h2>
      <p className="lede admin-lede">
        Assign members and edit the admin-area ACL stub for this group. Nav items can use{' '}
        <code>group:{group.id}</code>.{' '}
        <Link href="/app/admin/users/groups">Back to groups</Link>
      </p>
      {group.description ? <p className="settings-hint">{group.description}</p> : null}
      <GroupDetailManager
        groupId={group.id}
        groupLabel={group.label}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: normalizeAppRole(m.role),
          joinedAt: m.joinedAt.toISOString(),
        }))}
        candidates={candidates}
        matrix={matrix}
      />
    </section>
  )
}
