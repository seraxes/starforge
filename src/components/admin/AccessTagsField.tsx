'use client'

import React from 'react'
import Link from 'next/link'

import { ROLE_ADMIN_ACCESS_TAG, toggleAccessTag } from '@/core/acl/nav-access'
import type { UserGroupOption } from '@/core/acl/types'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  groups: UserGroupOption[]
  disabled?: boolean
  /** Optional legend override (default: Who can see). */
  legend?: string
  className?: string
  /**
   * When true, an empty selection stays empty (no auto-`public`).
   * Use for Admin nav links that require role:admin and/or a group.
   */
  allowEmpty?: boolean
}

/**
 * Shared multi-select viewing tags (Nav / Layout / Page Settings).
 * Tokens: `public` | `registered` | `role:admin` | `group:<id>`. Match ANY;
 * empty → public unless `allowEmpty`.
 */
export function AccessTagsField({
  value,
  onChange,
  groups,
  disabled,
  legend = 'Who can see',
  className,
  allowEmpty = false,
}: Props) {
  const tags = value.length > 0 ? value : allowEmpty ? [] : ['public']

  function setTag(tag: string, on: boolean) {
    const next = toggleAccessTag(tags, tag, on)
    if (allowEmpty && next.length === 1 && next[0] === 'public' && !on && tag !== 'public') {
      // toggleAccessTag coerces empty → public; keep empty for Admin link adds.
      const without = tags.filter((t) => t !== tag)
      onChange(without)
      return
    }
    if (allowEmpty && !on && tag === 'public' && next.length === 1 && next[0] === 'public') {
      onChange([])
      return
    }
    onChange(next)
  }

  return (
    <fieldset className={['settings-field', 'nav-access-tags', className].filter(Boolean).join(' ')}>
      <legend>{legend}</legend>
      <p className="settings-hint">
        Multi-select: Public, Registered, Admin role, or groups. Visible if the viewer matches{' '}
        <strong>any</strong> tag.{' '}
        {allowEmpty ? (
          <>Admin links need Admin role and/or at least one group.</>
        ) : (
          <>Empty = public.</>
        )}{' '}
        <Link href="/admin/users/groups">Manage groups</Link>.
      </p>
      <div className="nav-access-tag-list">
        <label className="outlines-check">
          <input
            type="checkbox"
            disabled={disabled}
            checked={tags.includes('public')}
            onChange={(e) => setTag('public', e.target.checked)}
          />
          <span>Public</span>
        </label>
        <label className="outlines-check">
          <input
            type="checkbox"
            disabled={disabled}
            checked={tags.includes('registered')}
            onChange={(e) => setTag('registered', e.target.checked)}
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
                onChange={(e) => setTag(tag, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          )
        })}
        {groups.length === 0 ? (
          <span className="settings-hint">No groups yet — create under Users → Groups.</span>
        ) : null}
        <label
          className="outlines-check"
          title="Better Auth platform role admin (Users → role), not a group"
        >
          <input
            type="checkbox"
            disabled={disabled}
            checked={tags.includes(ROLE_ADMIN_ACCESS_TAG)}
            onChange={(e) => setTag(ROLE_ADMIN_ACCESS_TAG, e.target.checked)}
          />
          <span>Admin role</span>
        </label>
      </div>
    </fieldset>
  )
}
