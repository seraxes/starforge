'use client'

import React, { useEffect, useRef, useState } from 'react'

import { authClient } from '@/core/auth/client'
import { Link } from '@/core/i18n/navigation'
import type { AccountMenuAvatarShape } from '@/core/modules/particles/config'

export type AccountMenuLink = {
  href: string
  label: string
}

/** Signed-in member shown above the dropdown links. */
export type AccountMenuIdentity = {
  href: string
  name: string
  avatarUrl?: string
  initial?: string
}

/**
 * Page identity row. Empty until sign-in-as-a-page exists.
 * A later slice passes rows here; this dropdown does not switch accounts.
 */
export type AccountMenuPageIdentity = {
  id: string
  href: string
  name: string
  avatarUrl?: string
  initial?: string
}

function AccountFace({
  shape,
  avatarUrl,
  initial,
}: {
  shape: AccountMenuAvatarShape
  avatarUrl: string
  initial: string
}) {
  return (
    <span className="sf-account-menu-identity-avatar" data-avatar-shape={shape} aria-hidden="true">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- member avatar URL from the media route
        <img src={avatarUrl} alt="" />
      ) : initial ? (
        <span className="sf-account-menu-letter">{initial}</span>
      ) : null}
    </span>
  )
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
  identity?: AccountMenuIdentity | null
  pageIdentities?: AccountMenuPageIdentity[]
}

/**
 * Header account control. One outline for every language: labels arrive
 * already translated for the request locale.
 * Navigation dropdown — closes on outside click / Escape (not a config panel).
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
  identity = null,
  pageIdentities = [],
}: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const glyphSize = Math.max(12, Math.round(avatarSize * 0.5))

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [open])

  async function signOut() {
    if (pending) return
    setPending(true)
    await authClient.signOut()
    window.location.assign(`/${locale}/login`)
  }

  return (
    <div
      ref={rootRef}
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
        <div className="sf-account-menu-panel" role="menu">
          {identity ? (
            <Link
              href={identity.href}
              className="sf-account-menu-identity"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <AccountFace
                shape={avatarShape}
                avatarUrl={identity.avatarUrl ?? ''}
                initial={identity.initial ?? ''}
              />
              <span className="sf-account-menu-identity-name">{identity.name}</span>
            </Link>
          ) : null}
          {pageIdentities.length > 0 ? (
            <ul className="sf-account-menu-pages" role="presentation">
              {pageIdentities.map((page) => (
                <li key={page.id} role="none">
                  <Link
                    href={page.href}
                    className="sf-account-menu-page"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                  >
                    <AccountFace
                      shape={avatarShape}
                      avatarUrl={page.avatarUrl ?? ''}
                      initial={page.initial ?? ''}
                    />
                    <span className="sf-account-menu-identity-name">{page.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <ul
            className={`sf-account-menu-list${
              identity || pageIdentities.length > 0 ? ' is-split' : ''
            }`}
            role="presentation"
          >
            {links.map((item, index) => (
              <li key={`${item.href}:${item.label}:${index}`} role="none">
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
        </div>
      ) : null}
    </div>
  )
}
