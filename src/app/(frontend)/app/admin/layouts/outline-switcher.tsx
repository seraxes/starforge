'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type OutlineOption = { id: string; label: string }

function outlineHref(basePath: string, id: string): string {
  if (id === 'default') return basePath
  return `${basePath}?outline=${encodeURIComponent(id)}`
}

export function OutlineSwitcher({
  outlines,
  currentId,
  /** Admin path this switcher should stay on (default: Layout canvas). */
  basePath = '/app/admin/layouts',
}: {
  outlines: OutlineOption[]
  currentId: string
  basePath?: string
}) {
  const router = useRouter()

  return (
    <div className="layout-outline-switcher-form">
      <label className="settings-field">
        <span>Outline</span>
        <select
          name="outline"
          value={currentId}
          aria-label="Switch layout outline"
          onChange={(event) => {
            router.push(outlineHref(basePath, event.target.value))
          }}
        >
          {outlines.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.id})
            </option>
          ))}
        </select>
      </label>
      <Link className="button-link" href="/app/admin/outlines">
        Manage outlines
      </Link>
    </div>
  )
}
