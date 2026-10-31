'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type OutlineOption = { id: string; label: string }

export function OutlineSwitcher({
  outlines,
  currentId,
}: {
  outlines: OutlineOption[]
  currentId: string
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
            const id = event.target.value
            router.push(
              id === 'default'
                ? '/app/admin/layouts'
                : `/app/admin/layouts?outline=${encodeURIComponent(id)}`,
            )
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
