import React from 'react'
import Link from 'next/link'

import { adminLogoutAction } from '@/core/auth/actions'

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

/** Avatar link + backend-only sign out for the Core admin sidebar. */
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
    <div className="admin-sidebar-account">
      <Link
        href={href}
        className="admin-sidebar-account-link"
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
      <form action={adminLogoutAction} className="admin-sidebar-account-signout">
        <button
          type="submit"
          className="admin-sidebar-account-signout-btn"
          title="Sign out of admin (keeps the public site session)"
          aria-label="Sign out of admin"
        >
          <svg
            className="admin-sidebar-account-signout-icon"
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="16 17 21 12 16 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </form>
    </div>
  )
}
