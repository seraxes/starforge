import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { withLocalePrefix } from '@/core/i18n/path'
import { FramedImage } from '@/modules/media/api'

import { personaMediaSrc } from '../api.server'
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

const GENDER_KEYS: Record<string, string> = {
  '': 'genderPreferNot',
  female: 'genderFemale',
  male: 'genderMale',
  nonbinary: 'genderNonbinary',
}

/**
 * Public profile page body. Renders only what the privacy-projected `Persona`
 * allows — it never sees the raw stored record.
 */
export async function PublicProfile({
  persona,
  locale,
  memberSince,
  adminEditHref,
  underName,
  headerExtra,
}: {
  persona: Persona
  locale: string
  memberSince: Date
  /** Shown to admins only. */
  adminEditHref?: string
  /** Optional line under the display name (e.g. mutual friends). */
  underName?: React.ReactNode
  /** Extra controls in the profile head actions (e.g. Follow). */
  headerExtra?: React.ReactNode
}) {
  const t = await getTranslations('product:profiles')
  const avatar = personaMediaSrc(persona.avatarMediaId)
  const cover = personaMediaSrc(persona.coverMediaId)
  const genderKey = persona.gender ? GENDER_KEYS[persona.gender] : null
  const gender = genderKey ? t(genderKey) : null
  const where = [persona.city, persona.country ? countryName(persona.country, locale) : null]
    .filter(Boolean)
    .join(', ')
  const facts: Array<{ label: string; value: string }> = []
  if (persona.ageYears != null) facts.push({ label: t('factAge'), value: String(persona.ageYears) })
  if (gender) facts.push({ label: t('factGender'), value: gender })
  if (where) facts.push({ label: t('factLocation'), value: where })
  facts.push({ label: t('factMemberSince'), value: memberSince.toISOString().slice(0, 10) })

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
          {underName ? <div className="sf-profile-under-name">{underName}</div> : null}
          <p className="sf-profile-handle">@{persona.handle}</p>
          {persona.headline ? <p className="sf-profile-headline">{persona.headline}</p> : null}
        </div>
        <div className="sf-profile-actions">
          {headerExtra}
          {persona.isSelf ? (
            <Link href={withLocalePrefix('/account/profile', locale)} className="sf-profile-btn">
              {t('editProfile')}
            </Link>
          ) : null}
          {adminEditHref ? (
            <Link href={adminEditHref} className="sf-profile-btn sf-profile-btn--ghost">
              {t('editInAdmin')}
            </Link>
          ) : null}
        </div>
      </header>

      <div className="sf-profile-body">
        {persona.bio ? (
          <section className="sf-profile-card">
            <h2>{t('about')}</h2>
            <p className="sf-profile-bio">{persona.bio}</p>
          </section>
        ) : null}

        <section className="sf-profile-card">
          <h2>{t('details')}</h2>
          <dl className="sf-profile-facts">
            {facts.map((fact) => (
              <React.Fragment key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </React.Fragment>
            ))}
            {persona.phone ? (
              <>
                <dt>{t('factPhone')}</dt>
                <dd>{persona.phone}</dd>
              </>
            ) : null}
          </dl>
        </section>

        {persona.website || persona.links.length > 0 ? (
          <section className="sf-profile-card">
            <h2>{t('links')}</h2>
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
