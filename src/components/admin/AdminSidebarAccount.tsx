import React from 'react'
import Link from 'next/link'

import {
  ADMIN_ACCOUNT_HREF,
  adminUserInitials,
} from './admin-sidebar-chrome'

export type AdminSidebarAccountProps = {
  email: string
  name?: string | null
  image?: string | null
  role?: string | null
}

/** Avatar link to the signed-in user’s account settings (replaces “Signed in as …”). */
export function AdminSidebarAccount({
  email,
  name,
  image,
  role,
}: AdminSidebarAccountProps) {
  const initials = adminUserInitials(name, email)
  const label = name?.trim() || email
  const tipParts = [label, role ? `(${role})` : null].filter(Boolean).join(' ')

  return (
    <Link
      href={ADMIN_ACCOUNT_HREF}
      className="admin-sidebar-account"
      title={`Account settings — ${tipParts}`}
      aria-label={`Account settings for ${email}`}
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
      </span>
    </Link>
  )
}
