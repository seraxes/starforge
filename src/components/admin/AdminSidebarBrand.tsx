import React from 'react'
import Link from 'next/link'

import {
  ADMIN_DASHBOARD_HREF,
  ADMIN_SHELL_LOGO_TOOLTIP,
  PAYLOAD_DASHBOARD_HREF,
} from './admin-sidebar-chrome'

export type AdminSidebarBrandSurface = 'core' | 'payload'

/** Compact left-rail brand: STARFORGE + Admin; logo → that surface's dashboard. */
export function AdminSidebarBrand(props: { surface?: AdminSidebarBrandSurface } = {}) {
  const href = props.surface === 'payload' ? PAYLOAD_DASHBOARD_HREF : ADMIN_DASHBOARD_HREF
  return (
    <>
      <p className="brand">
        <Link href={href} className="admin-sidebar-logo" title={ADMIN_SHELL_LOGO_TOOLTIP}>
          STARFORGE
        </Link>
      </p>
      <p className="admin-sidebar-kicker">Admin</p>
    </>
  )
}
