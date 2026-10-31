import React from 'react'

import type { StarforgeModule } from '../types'

/**
 * Custom HTML + CSS particle (Gantry Custom). JS is stored but not executed
 * until developer-admin ACL lands.
 */
export const customModule: StarforgeModule = {
  id: 'custom',
  name: 'Custom',
  description: 'HTML + CSS (+ JS stub for developer-admins later).',
  builtin: true,
  defaultWidth: 100,
  render: ({ slot }) => {
    const html = typeof slot.config?.html === 'string' ? slot.config.html : ''
    const css = typeof slot.config?.css === 'string' ? slot.config.css : ''
    const js = typeof slot.config?.js === 'string' ? slot.config.js.trim() : ''
    const title = typeof slot.config?.title === 'string' ? slot.config.title : ''
    const scope = `sf-custom-${slot.id}`

    if (!html.trim() && !css.trim()) {
      return (
        <div className="sf-custom-empty" data-sf-custom={slot.id}>
          <p>Custom particle — add HTML/CSS in the layout editor.</p>
        </div>
      )
    }

    return (
      <div className={`sf-custom ${scope}`} data-sf-custom={slot.id}>
        {title ? <span className="sr-only">{title}</span> : null}
        {css.trim() ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
        {html.trim() ? (
          <div className="sf-custom-html" dangerouslySetInnerHTML={{ __html: html }} />
        ) : null}
        {js ? (
          <p className="sf-custom-js-stub" role="note">
            Custom JS is saved ({js.length} chars) but not executed yet — developer-admin only
            later.
          </p>
        ) : null}
      </div>
    )
  },
}
