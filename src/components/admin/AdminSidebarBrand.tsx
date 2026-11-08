import React from 'react'
import Link from 'next/link'

import {
  ADMIN_CHECK_SITE_HREF,
  ADMIN_DASHBOARD_HREF,
  ADMIN_SHELL_LOGO_TOOLTIP,
  PAYLOAD_DASHBOARD_HREF,
} from './admin-sidebar-chrome'

export type AdminSidebarBrandSurface = 'core' | 'payload'

/** Compact left-rail brand: STARFORGE + Admin; Check site icon to the right of the logo. */
export function AdminSidebarBrand(props: { surface?: AdminSidebarBrandSurface } = {}) {
  const href = props.surface === 'payload' ? PAYLOAD_DASHBOARD_HREF : ADMIN_DASHBOARD_HREF
  return (
    <div className="admin-sidebar-brand-row">
      <div className="admin-sidebar-brand-main">
        <p className="brand">
          <Link href={href} className="admin-sidebar-logo" title={ADMIN_SHELL_LOGO_TOOLTIP}>
            STARFORGE
          </Link>
        </p>
        <p className="admin-sidebar-kicker">Admin</p>
      </div>
      <a
        href={ADMIN_CHECK_SITE_HREF}
        className="admin-sidebar-check-site"
        target="_blank"
        rel="noopener noreferrer"
        title="Open the public site"
      >
        <span className="admin-sidebar-check-site-icon" aria-hidden="true" />
        <span className="admin-sidebar-check-site-label">check site</span>
      </a>
    </div>
  )
}
