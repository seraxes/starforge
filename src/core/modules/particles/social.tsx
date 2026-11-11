import React from 'react'
import Link from 'next/link'

import { buildLayoutSlotKey } from '@/core/i18n/content-locale-keys'
import { pickContentLocaleText } from '@/core/i18n/locale-text.server'
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
  render: async ({ slot, layoutId }) => {
    const { items } = readSocialConfig(slot.config)
    if (!items || items.length === 0) {
      return (
        <div className="sf-social sf-social-empty" data-sf-particle="social" data-sf-slot={slot.id}>
          <p>Social — add links in the layout editor.</p>
        </div>
      )
    }

    const outlineId = layoutId || 'default'
    return (
      <nav className="sf-social" data-sf-particle="social" data-sf-slot={slot.id} aria-label="Social links">
        <ul className="sf-social-list">
          {await Promise.all(items.map(async (item) => {
            const label = (
              await pickContentLocaleText(
                buildLayoutSlotKey({
                  layoutId: outlineId,
                  slotId: slot.id,
                  field: 'label',
                  itemId: item.id,
                }),
                item.label || item.platform || 'Link',
                item.labelLocales,
              )
            ).trim()
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
          }))}
        </ul>
      </nav>
    )
  },
}
