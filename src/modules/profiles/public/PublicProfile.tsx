import React from 'react'
import Link from 'next/link'

import { withLocalePrefix } from '@/core/i18n/path'
import { FramedImage } from '@/modules/media/api'

import { personaMediaSrc } from '../api.server'
import { GENDER_OPTIONS } from '../fields'
import type { Persona } from '../types'

function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale || 'en'], { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')
  return letters.toUpperCase() || '?'
}

function hostLabel(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Public profile page body. Renders only what the privacy-projected `Persona`
 * allows — it never sees the raw stored record.
 */
export function PublicProfile({
  persona,
  locale,
  memberSince,
  adminEditHref,
}: {
  persona: Persona
  locale: string
  memberSince: Date
  /** Shown to admins only. */
  adminEditHref?: string
}) {
  const avatar = personaMediaSrc(persona.avatarMediaId)
  const cover = personaMediaSrc(persona.coverMediaId)
  const gender = persona.gender
    ? GENDER_OPTIONS.find((o) => o.value === persona.gender)?.label
    : null
  const where = [persona.city, persona.country ? countryName(persona.country, locale) : null]
    .filter(Boolean)
    .join(', ')
  const facts: Array<{ label: string; value: string }> = []
  if (persona.ageYears != null) facts.push({ label: 'Age', value: String(persona.ageYears) })
  if (gender) facts.push({ label: 'Gender', value: gender })
  if (where) facts.push({ label: 'Location', value: where })
  facts.push({ label: 'Member since', value: memberSince.toISOString().slice(0, 10) })

  return (
    <article className="sf-profile" aria-label={persona.displayName}>
      <div className="sf-profile-cover">
        {cover ? (
          <FramedImage
            src={cover}
            frame={persona.coverFrame}
            shape="wide"
            alt=""
            className="sf-profile-cover-frame"
          />
        ) : null}
      </div>
      <header className="sf-profile-head">
        <div className="sf-profile-avatar" aria-hidden={avatar ? undefined : true}>
          {avatar ? (
            <FramedImage
              src={avatar}
              frame={persona.avatarFrame}
              shape="circle"
              alt={persona.displayName}
            />
          ) : (
            <span>{initials(persona.displayName)}</span>
          )}
        </div>
        <div className="sf-profile-id">
          <h1>{persona.displayName}</h1>
          <p className="sf-profile-handle">@{persona.handle}</p>
          {persona.headline ? <p className="sf-profile-headline">{persona.headline}</p> : null}
        </div>
        <div className="sf-profile-actions">
          {persona.isSelf ? (
            <Link href={withLocalePrefix('/account/profile', locale)} className="sf-profile-btn">
              Edit profile
            </Link>
          ) : null}
          {adminEditHref ? (
            <Link href={adminEditHref} className="sf-profile-btn sf-profile-btn--ghost">
              Edit in admin
            </Link>
          ) : null}
        </div>
      </header>

      <div className="sf-profile-body">
        {persona.bio ? (
          <section className="sf-profile-card">
            <h2>About</h2>
            <p className="sf-profile-bio">{persona.bio}</p>
          </section>
        ) : null}

        <section className="sf-profile-card">
          <h2>Details</h2>
          <dl className="sf-profile-facts">
            {facts.map((fact) => (
              <React.Fragment key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </React.Fragment>
            ))}
            {persona.phone ? (
              <>
                <dt>Phone</dt>
                <dd>{persona.phone}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {persona.website || persona.links.length > 0 ? (
          <section className="sf-profile-card">
            <h2>Links</h2>
            <ul className="sf-profile-links-list">
              {persona.website ? (
                <li>
                  <a href={persona.website} rel="nofollow noopener noreferrer ugc" target="_blank">
                    {hostLabel(persona.website)}
                  </a>
                </li>
              ) : null}
              {persona.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} rel="nofollow noopener noreferrer ugc" target="_blank">
                    {link.label || hostLabel(link.url)}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  )
}
