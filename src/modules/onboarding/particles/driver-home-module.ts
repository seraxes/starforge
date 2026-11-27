import React from 'react'

import { getAppSession } from '@/core/auth/session'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { DriverHomeView } from '../public/driver-home-view'
import { loadDriverHomeForUser } from '../public/load-driver-home'

/**
 * driver-home particle — current status message, action chip, and tiles.
 * Pack off or no signed-in person → render nothing.
 */
export const driverHomeModule: StarforgeModule = {
  id: 'driver-home',
  name: 'Driver home',
  description: 'Onboarding status home for the signed-in person.',
  defaultWidth: 100,
  render: async ({ settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.onboarding)) {
      return null
    }

    const session = await getAppSession()
    const userId = session?.user?.id ? String(session.user.id).trim() : ''
    if (!userId) return null

    const home = await loadDriverHomeForUser(userId)
    if (!home) return null

    return React.createElement(DriverHomeView, home)
  },
}
