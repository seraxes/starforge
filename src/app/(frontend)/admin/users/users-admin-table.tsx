'use client'

import React from 'react'
import Link from 'next/link'

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: string
  cmsAccess: boolean
  banned: boolean
  banReason: string | null
  createdAt: string
  groupIds: string[]
  /** Present when product:profiles is enabled. */
  handle?: string | null
  profileStatus?: string | null
  hasProfile?: boolean
  completeness?: number | null
}

export function UsersAdminTable({
  users,
  q,
  profilesEnabled,
}: {
  users: AdminUserRow[]
  q: string
  profilesEnabled: boolean
}) {
  return (
    <div className="admin-settings-mosaic">
      <section className="outlines-create" aria-label="Directory filters">
        <form method="get" className="admin-action-row sf-profiles-filter-bar">
          <label className="settings-field">
            <span>Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder={
                profilesEnabled ? 'Name, email or username' : 'Name or email'
              }
              maxLength={100}
            />
          </label>
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted">
            Filter
          </button>
          {q ? (
            <Link href="/admin/users" className="gantry-toolbar-btn gantry-toolbar-btn-muted">
              Clear
            </Link>
          ) : null}
        </form>
      </section>

      {users.length === 0 ? (
        <p className="admin-empty">
          {q ? (
            <>No accounts match.</>
          ) : (
            <>
              No app users yet. Register at <Link href="/register">/register</Link>, run{' '}
              <code>npm run seed</code>, or set <code>STARFORGE_ADMIN_EMAILS</code> then register
              that email.
            </>
          )}
        </p>
      ) : (
        <div className="admin-table-wrap admin-settings-panel-wide">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                {profilesEnabled ? <th scope="col">Username</th> : null}
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                {profilesEnabled ? <th scope="col">Profile</th> : null}
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} data-banned={user.banned ? 'true' : 'false'}>
                  <td>
                    <Link href={`/admin/users/${user.id}`} className="sf-events-list-title">
                      {user.name || user.email}
                    </Link>
                  </td>
                  <td>
                    <code>{user.email}</code>
                  </td>
                  {profilesEnabled ? (
                    <td>{user.handle ? `@${user.handle}` : '—'}</td>
                  ) : null}
                  <td>
                    <code>{user.role}</code>
                  </td>
                  <td>
                    {user.banned ? (
                      <span
                        className="admin-badge admin-badge-warn"
                        title={user.banReason ?? undefined}
                      >
                        Disabled
                      </span>
                    ) : (
                      <span className="admin-badge">Active</span>
                    )}
                  </td>
                  {profilesEnabled ? (
                    <td>
                      {user.hasProfile
                        ? `${user.profileStatus ?? 'active'}${
                            typeof user.completeness === 'number'
                              ? ` · ${user.completeness}%`
                              : ''
                          }`
                        : 'no profile'}
                    </td>
                  ) : null}
                  <td>
                    <time dateTime={user.createdAt}>
                      {new Date(user.createdAt).toLocaleDateString('hu-HU')}
                    </time>
                  </td>
                  <td>
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
