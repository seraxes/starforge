import React from 'react'
import Link from 'next/link'

import type { StarforgeModule } from '../types'
import { readCopyrightConfig } from './config'

/**
 * Typed Copyright particle — text + auto/manual year + optional link.
 */
export const copyrightModule: StarforgeModule = {
  id: 'copyright',
  name: 'Copyright',
  description: 'Copyright text with auto or manual year and optional link.',
  builtin: true,
  defaultWidth: 50,
  render: ({ slot }) => {
    const cfg = readCopyrightConfig(slot.config)
    const year =
      cfg.yearMode === 'manual' && typeof cfg.year === 'number'
        ? cfg.year
        : new Date().getFullYear()
    const text = (cfg.text ?? '').trim() || 'All rights reserved.'
    const linkUrl = (cfg.linkUrl ?? '').trim()
    const linkLabel = (cfg.linkLabel ?? '').trim() || linkUrl

    return (
      <p className="sf-copyright" data-sf-particle="copyright" data-sf-slot={slot.id}>
        <span className="sf-copyright-mark">© {year}</span>
        {text ? <span className="sf-copyright-text"> {text}</span> : null}
        {linkUrl ? (
          <>
            {' '}
            <Link href={linkUrl} className="sf-copyright-link">
              {linkLabel}
            </Link>
          </>
        ) : null}
      </p>
    )
  },
}
