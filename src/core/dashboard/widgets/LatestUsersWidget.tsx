import React from 'react'
import Link from 'next/link'

import { coreAdminPath } from '@/core/admin-paths'

import { loadLatestUsersStats } from './users-stats'

function formatRegisteredAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

/** Core Dashboard — 10 latest registered users. */
export async function LatestUsersWidget() {
  const { users } = await loadLatestUsersStats()

  return (
    <div className="sf-dashboard-latest" aria-label="Latest registered users">
      {users.length === 0 ? (
        <p className="sf-dashboard-empty-inline">No users yet.</p>
      ) : (
        <div className="outlines-table-wrap admin-settings-panel-wide sf-dashboard-table-wrap">
          <table className="admin-table sf-dashboard-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Groups</th>
                <th scope="col">Registered</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.groupLabels.length ? user.groupLabels.join(', ') : '—'}</td>
                  <td>
                    <time dateTime={user.createdAt}>{formatRegisteredAt(user.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="sf-dashboard-card-foot">
        <Link href={coreAdminPath('/users')}>All users</Link>
      </p>
    </div>
  )
}

export default LatestUsersWidget
