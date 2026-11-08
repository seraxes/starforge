import React from 'react'
import Link from 'next/link'

import {
  adminAccountHref,
  adminUserInitials,
} from './admin-sidebar-chrome'

export type AdminSidebarAccountProps = {
  userId: string
  email: string
  name?: string | null
  image?: string | null
  role?: string | null
}

/** Avatar link to the signed-in user’s Core admin account (`/admin/users/:id`). */
export function AdminSidebarAccount({
  userId,
  email,
  name,
  image,
  role,
}: AdminSidebarAccountProps) {
  const initials = adminUserInitials(name, email)
  const label = name?.trim() || email
  const meta = role?.trim() || 'Account'
  const tipParts = [label, role ? `(${role})` : null].filter(Boolean).join(' ')
  const href = adminAccountHref(userId)

  return (
    <Link
      href={href}
      className="admin-sidebar-account"
      title={`Admin account — ${tipParts}`}
      aria-label={`Open admin account for ${email}`}
    >
      <span className="admin-sidebar-avatar" aria-hidden="true">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- session image URL may be external
          <img src={image} alt="" className="admin-sidebar-avatar-img" />
        ) : (
          <span className="admin-sidebar-avatar-initials">{initials}</span>
        )}
      </span>
      <span className="admin-sidebar-account-text">
        <span className="admin-sidebar-account-name">{label}</span>
        <span className="admin-sidebar-account-meta">{meta}</span>
      </span>
    </Link>
  )
}
