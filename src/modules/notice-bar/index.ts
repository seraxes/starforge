import React from 'react'

import type { StarforgeModule } from '@/core/modules/types'

import { NoticeBar } from './NoticeBar'

const DEFAULT_MESSAGE =
  'Extension modules are on — this dismissible notice bar is assigned to the header layout position. Toggle Modules under Site settings to hide it.'

/**
 * Example Starforge module: dismissible notice bar.
 * Placement comes from the layout document (`sf_layouts` / default JSON), not
 * from hard-coded position locks in this file.
 */
export const noticeBarModule: StarforgeModule = {
  id: 'notice-bar',
  name: 'Notice bar',
  description: 'Dismissible site-wide notice. Seed assigns it to the header position.',
  defaultPosition: 'header',
  featureFlag: 'modules',
  render: () =>
    React.createElement(NoticeBar, {
      title: 'Starforge modules',
      message: DEFAULT_MESSAGE,
    }),
}
