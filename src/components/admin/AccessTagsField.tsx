'use client'

import React from 'react'
import Link from 'next/link'

import { toggleAccessTag } from '@/core/acl/nav-access'
import type { UserGroupOption } from '@/core/acl/types'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  groups: UserGroupOption[]
  disabled?: boolean
  /** Optional legend override (default: Who can see). */
  legend?: string
  className?: string
}

/**
 * Shared multi-select viewing tags (Nav / Layout / Page Settings).
 * Tokens: `public` | `registered` | `group:<id>`. Match ANY; empty → public.
 */
export function AccessTagsField({
  value,
  onChange,
  groups,
  disabled,
  legend = 'Who can see',
  className,
}: Props) {
  const tags = value.length > 0 ? value : ['public']

  return (
    <fieldset className={['settings-field', 'nav-access-tags', className].filter(Boolean).join(' ')}>
      <legend>{legend}</legend>
      <p className="settings-hint">
        Multi-select groups (plus Public / Registered). Visible if the viewer matches{' '}
        <strong>any</strong> tag. Empty = public.{' '}
        <Link href="/app/admin/users/groups">Manage groups</Link>.
      </p>
      <div className="nav-access-tag-list">
        <label className="outlines-check">
          <input
            type="checkbox"
            disabled={disabled}
            checked={tags.includes('public')}
            onChange={(e) => onChange(toggleAccessTag(tags, 'public', e.target.checked))}
          />
          <span>Public</span>
        </label>
        <label className="outlines-check">
          <input
            type="checkbox"
            disabled={disabled}
            checked={tags.includes('registered')}
            onChange={(e) => onChange(toggleAccessTag(tags, 'registered', e.target.checked))}
          />
          <span>Registered</span>
        </label>
        {groups.map((g) => {
          const tag = `group:${g.id}`
          const label = (g.label || g.id).trim() || g.id
          return (
            <label key={g.id} className="outlines-check" title={g.id !== label ? g.id : undefined}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={tags.includes(tag)}
                onChange={(e) => onChange(toggleAccessTag(tags, tag, e.target.checked))}
              />
              <span>{label}</span>
            </label>
          )
        })}
        {groups.length === 0 ? (
          <span className="settings-hint">No groups yet — create under Users → Groups.</span>
        ) : null}
      </div>
    </fieldset>
  )
}
