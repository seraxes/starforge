import React from 'react'

import type { StarforgeModule } from '../types'
import { readSpacerConfig } from './config'

/**
 * Spacer particle — plain empty gap for vertical/horizontal spacing.
 * No content; size comes from cog height (and optional width).
 */
export const spacerModule: StarforgeModule = {
  id: 'spacer',
  name: 'Spacer',
  description: 'Empty gap for vertical or horizontal spacing (no content).',
  builtin: true,
  defaultWidth: 100,
  render: ({ slot }) => {
    const cfg = readSpacerConfig(slot.config)
    const style: React.CSSProperties = {
      display: 'block',
      boxSizing: 'border-box',
      height: cfg.height,
      minHeight: cfg.height,
      width: cfg.width != null ? cfg.width : '100%',
      maxWidth: '100%',
      flexShrink: 0,
      margin: 0,
      padding: 0,
      border: 0,
      background: 'transparent',
      pointerEvents: 'none',
    }
    return (
      <div
        className="sf-spacer"
        data-sf-particle="spacer"
        data-sf-slot={slot.id}
        aria-hidden="true"
        style={style}
      />
    )
  },
}
