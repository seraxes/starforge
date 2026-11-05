import React from 'react'
import Link from 'next/link'

import { ADMIN_SHELL_LOGO_TOOLTIP } from './admin-sidebar-chrome'

/** Compact left-rail brand: STARFORGE + Admin; logo carries former header tooltip. */
export function AdminSidebarBrand() {
  return (
    <>
      <p className="brand">
        <Link
          href="/"
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
