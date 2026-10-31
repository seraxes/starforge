import React from 'react'

import type { StarforgeModule } from '../types'

/**
 * Gantry-like “Page Content” particle — renders the current route’s page body
 * (CMS `[slug]`, home shell, etc.) wherever it is placed in the layout.
 */
export const pageContentModule: StarforgeModule = {
  id: 'page-content',
  name: 'Page Content',
  description: 'Main CMS / route body (like Gantry Page Content).',
  builtin: true,
  defaultWidth: 12,
  render: ({ pageContent }) => {
    if (pageContent == null) {
      return (
        <div className="sf-page-content sf-page-content-empty">
          <p className="lede">No page content for this route.</p>
        </div>
      )
    }
    return <div className="sf-page-content public-main">{pageContent}</div>
  },
}
