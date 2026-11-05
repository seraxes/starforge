import React from 'react'
import Link from 'next/link'

import {
  ADMIN_DASHBOARD_HREF,
  ADMIN_SHELL_LOGO_TOOLTIP,
} from './admin-sidebar-chrome'

/** Compact left-rail brand: STARFORGE + Admin; logo → Dashboard; tooltip kept. */
export function AdminSidebarBrand() {
  return (
    <>
      <p className="brand">
        <Link
          href={ADMIN_DASHBOARD_HREF}
          className="admin-sidebar-logo"
          title={ADMIN_SHELL_LOGO_TOOLTIP}
        >
          STARFORGE
        </Link>
      </p>
      <p className="admin-sidebar-kicker">Admin</p>
    </>
  )
}
