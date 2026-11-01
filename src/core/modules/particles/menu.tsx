import React from 'react'

import { SiteNav } from '@/components/SiteNav'
import { getAccessViewer } from '@/core/acl/access'
import { filterNavItemsForViewer } from '@/core/acl/nav-access'
import { DEFAULT_NAV_MENU_ID, resolveNavMenuItems } from '@/core/nav'
import { MODULE_IDS, isModuleToggleEnabled } from '@/core/settings/module-toggles'

import type { StarforgeModule } from '../types'
import { readMenuConfig } from './config'

/**
 * Menu particle — renders a Nav manager menu set (default = site primary).
 * Prefer with Logo particle instead of the combined Site Header for flexible layouts.
 */
export const menuModule: StarforgeModule = {
  id: 'menu',
  name: 'Menu',
  description:
    'Navigation links from a Nav manager menu set. Empty menu id = site primary (Main).',
  builtin: true,
  defaultWidth: 75,
  render: async ({ slot, settings }) => {
    const navOn = isModuleToggleEnabled(settings, MODULE_IDS.primaryNav, {
      defaultEnabled: true,
    })
    if (!navOn) return null

    const cfg = readMenuConfig(slot.config)
    const menuId =
      (cfg.menuId ?? '').trim() ||
      (settings.primaryNavMenuId ?? '').trim() ||
      DEFAULT_NAV_MENU_ID

    const resolved = await resolveNavMenuItems(menuId, settings)
    const viewer = await getAccessViewer()
    const items = filterNavItemsForViewer(resolved, viewer)
    if (items.length === 0) {
      return (
        <div className="sf-menu sf-menu-empty" data-sf-particle="menu" data-sf-slot={slot.id}>
          <p className="layout-muted">No visible links in this menu.</p>
        </div>
      )
    }

    return (
      <div
        className="sf-menu"
        data-sf-particle="menu"
        data-sf-slot={slot.id}
        data-sf-menu-id={menuId}
      >
        <SiteNav items={items} ariaLabel={cfg.ariaLabel || 'Primary'} />
      </div>
    )
  },
}
