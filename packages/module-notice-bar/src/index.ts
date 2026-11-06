import React, { type ReactNode } from 'react'

import { NoticeBar } from './NoticeBar'

const DEFAULT_MESSAGE =
  'Extension modules are on — this notice bar particle sits in the Header section (100%). Edit layout under /admin/layouts.'

/**
 * Particle contract expected by Starforge Core `registerModule` / SlotRenderer.
 * Kept structural so this package does not import the host app.
 */
export type NoticeBarStarforgeModule = {
  id: string
  name: string
  description?: string
  featureFlag?: string
  defaultWidth?: number
  render: () => ReactNode | Promise<ReactNode>
}

/**
 * Example Starforge particle: dismissible notice bar.
 * Placement comes from the layout document (`sf_layouts`), not hard locks.
 */
export const noticeBarModule: NoticeBarStarforgeModule = {
  id: 'notice-bar',
  name: 'Notice bar',
  description: 'Dismissible site-wide notice. Seed places it in Header at 100%.',
  defaultWidth: 100,
  featureFlag: 'modules',
  render: () =>
    React.createElement(NoticeBar, {
      title: 'Starforge modules',
      message: DEFAULT_MESSAGE,
    }),
}

export { NoticeBar }
