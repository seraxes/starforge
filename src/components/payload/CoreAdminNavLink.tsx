'use client'

import { NavGroup } from '@payloadcms/ui'
import React from 'react'

/**
 * Persistent Payload admin sidebar link back to Starforge core admin.
 * Core ↔ Content CMS should feel like one platform with two surfaces.
 */
export default function CoreAdminNavLink() {
  return (
    <NavGroup isOpen label="Starforge">
      <a className="nav__link" href="/app/admin" id="nav-starforge-admin">
        <span className="nav__link-label">Core admin</span>
      </a>
    </NavGroup>
  )
}
