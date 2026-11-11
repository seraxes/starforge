'use client'

import React, { useState } from 'react'

import { authClient } from '@/core/auth/client'
import { Link } from '@/core/i18n/navigation'
import type { AccountMenuAvatarShape } from '@/core/modules/particles/config'

export type AccountMenuLink = {
  href: string
  label: string
}

type Props = {
  locale: string
  signedIn: boolean
  /** First letter of the member's name. Empty when signed out. */
  initial: string
  avatarUrl: string
  avatarShape?: AccountMenuAvatarShape
  /** Edge length in CSS pixels. */
  avatarSize?: number
  menuLabel: string
  links: AccountMenuLink[]
  signOutLabel: string
}

/**
 * Header account control. One outline for every language: labels arrive
 * already translated for the request locale.
 */
export function AccountMenu({
  locale,
  signedIn,
  initial,
  avatarUrl,
  avatarShape = 'circle',
  avatarSize = 36,
  menuLabel,
  links,
  signOutLabel,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const glyphSize = Math.max(12, Math.round(avatarSize * 0.5))

  async function signOut() {
    if (pending) return
    setPending(true)
    await authClient.signOut()
    window.location.assign(`/${locale}/login`)
  }

  return (
    <div
      className={`sf-account-menu${open ? ' is-open' : ''}`}
      style={{ ['--sf-account-avatar-size' as string]: `${avatarSize}px` }}
      data-avatar-shape={avatarShape}
    >
      <button
        type="button"
        className="sf-account-menu-button"
        data-avatar-shape={avatarShape}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={menuLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- member avatar URL from the media route
          <img src={avatarUrl} alt="" className="sf-account-menu-avatar" />
        ) : signedIn && initial ? (
          <span className="sf-account-menu-letter" aria-hidden="true">
            {initial}
          </span>
        ) : (
          <span className="sf-account-menu-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={glyphSize} height={glyphSize} focusable="false">
              <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M5.5 19.2c1.4-3 3.6-4.4 6.5-4.4s5.1 1.4 6.5 4.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </span>
        )}
      </button>
      {open ? (
        <ul className="sf-account-menu-list" role="menu">
          {links.map((item) => (
            <li key={item.href} role="none">
              <Link href={item.href} role="menuitem" onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            </li>
          ))}
          {signedIn ? (
            <li role="none">
              <button type="button" role="menuitem" disabled={pending} onClick={() => void signOut()}>
                {signOutLabel}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
