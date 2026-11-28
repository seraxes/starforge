'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import { Globe, Lock, UserCheck, Users, type LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { type VisibilityScope } from '../fields'

const SCOPE_ICONS: Record<VisibilityScope, LucideIcon> = {
  public: Globe,
  registered: Users,
  friends: UserCheck,
  private: Lock,
}

const SCOPE_KEYS: Record<VisibilityScope, string> = {
  public: 'visibilityPublic',
  registered: 'visibilityRegistered',
  friends: 'visibilityFriends',
  private: 'visibilityPrivate',
}

type Props = {
  label: string
  scope: VisibilityScope
  scopes: readonly VisibilityScope[]
  disabled?: boolean
  onChange: (scope: VisibilityScope) => void
}

/**
 * Audience control for a profile field — icon only until opened; menu shows icon + label.
 */
export function ProfileVisibilityControl({
  label,
  scope,
  scopes,
  disabled = false,
  onChange,
}: Props) {
  const t = useTranslations('product:profiles')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const Icon = SCOPE_ICONS[scope]
  const scopeLabel = t(SCOPE_KEYS[scope])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={rootRef}
      className={open ? 'sf-profile-vis-control is-open' : 'sf-profile-vis-control'}
    >
      <button
        type="button"
        className="sf-profile-vis-trigger"
        aria-label={t('whoCanSeeTrigger', { label, scope: scopeLabel })}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Icon aria-hidden size={16} strokeWidth={2.25} />
      </button>
      {open ? (
        <ul
          id={menuId}
          className="sf-profile-vis-menu"
          role="listbox"
          aria-label={t('whoCanSeeMenu', { label })}
        >
          {scopes.map((option) => {
            const OptionIcon = SCOPE_ICONS[option]
            const selected = option === scope
            return (
              <li key={option} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={
                    selected
                      ? 'sf-profile-vis-option is-selected'
                      : 'sf-profile-vis-option'
                  }
                  disabled={disabled}
                  onClick={() => {
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  <OptionIcon aria-hidden size={16} strokeWidth={2.25} />
                  <span>{t(SCOPE_KEYS[option])}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
