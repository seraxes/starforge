import React from 'react'
import Link from 'next/link'

import type { StarforgeModule } from '../types'
import { readSocialConfig } from './config'

/**
 * Typed Social particle — list of platform / URL / optional label+icon links.
 */
export const socialModule: StarforgeModule = {
  id: 'social',
  name: 'Social',
  description: 'List of social links (platform, URL, optional icon/label).',
  builtin: true,
  defaultWidth: 50,
  render: ({ slot }) => {
    const { items } = readSocialConfig(slot.config)
    if (!items || items.length === 0) {
      return (
        <div className="sf-social sf-social-empty" data-sf-particle="social" data-sf-slot={slot.id}>
          <p>Social — add links in the layout editor.</p>
        </div>
      )
    }

    return (
      <nav className="sf-social" data-sf-particle="social" data-sf-slot={slot.id} aria-label="Social links">
        <ul className="sf-social-list">
          {items.map((item) => {
            const label = (item.label || item.platform || 'Link').trim()
            const icon = (item.icon ?? '').trim()
            return (
              <li key={item.id}>
                <Link
                  href={item.url || '#'}
                  className="sf-social-link"
                  target={item.url.startsWith('http') ? '_blank' : undefined}
                  rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                  {icon ? (
                    <span className="sf-social-icon" aria-hidden="true">
                      {icon}
                    </span>
                  ) : null}
                  <span className="sf-social-label">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    )
  },
}
