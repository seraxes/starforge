import React from 'react'

import type { StarforgeModule } from '@/core/modules/types'

import { NoticeBar } from './NoticeBar'

const DEFAULT_MESSAGE =
  'Extension modules are on — this notice bar particle sits in the Header section (12/12). Edit layout under /app/admin/layouts.'

/**
 * Example Starforge particle: dismissible notice bar.
 * Placement comes from the layout document (`sf_layouts`), not hard locks.
 */
export const noticeBarModule: StarforgeModule = {
  id: 'notice-bar',
  name: 'Notice bar',
  description: 'Dismissible site-wide notice. Seed places it in Header at width 12.',
  defaultWidth: 12,
  featureFlag: 'modules',
  render: () =>
    React.createElement(NoticeBar, {
      title: 'Starforge modules',
      message: DEFAULT_MESSAGE,
    }),
}
