import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import React from 'react'

export type EntityTab = 'wall' | 'members' | 'about' | 'calendar'

function tabHref(baseHref: string, tab: EntityTab): string {
  return tab === 'wall' ? baseHref : `${baseHref}?tab=${tab}`
}

function tabClass(active: boolean): string {
  return active ? 'sf-social-entity-tab is-active' : 'sf-social-entity-tab'
}

/** Wall / Members / About / Calendar. Calendar is omitted when Events is off. */
export async function SocialEntityTabs({
  baseHref,
  active,
  showCalendar,
}: {
  baseHref: string
  active: EntityTab
  showCalendar: boolean
}) {
  const t = await getTranslations('product:social')
  return (
    <nav className="sf-social-entity-tabs" aria-label={t('entityTabsAriaLabel')}>
      <Link
        className={tabClass(active === 'wall')}
        href={tabHref(baseHref, 'wall')}
        aria-current={active === 'wall' ? 'page' : undefined}
      >
        {t('tabWall')}
      </Link>
      <Link
        className={tabClass(active === 'members')}
        href={tabHref(baseHref, 'members')}
        aria-current={active === 'members' ? 'page' : undefined}
      >
        {t('tabMembers')}
      </Link>
      <Link
        className={tabClass(active === 'about')}
        href={tabHref(baseHref, 'about')}
        aria-current={active === 'about' ? 'page' : undefined}
      >
        {t('tabAbout')}
      </Link>
      {showCalendar ? (
        <Link
          className={tabClass(active === 'calendar')}
          href={tabHref(baseHref, 'calendar')}
          aria-current={active === 'calendar' ? 'page' : undefined}
        >
          {t('tabCalendar')}
        </Link>
      ) : null}
    </nav>
  )
}

/** Resolve `?tab=` for group/page surfaces. Invalid or Events-off calendar falls back. */
export function resolveEntityTab(
  raw: string | undefined,
  eventsEnabled: boolean,
  fallback: EntityTab,
): EntityTab {
  const tab = (raw ?? '').trim()
  if (tab === 'members' || tab === 'about' || tab === 'wall') return tab
  if (tab === 'calendar' && eventsEnabled) return 'calendar'
  return fallback
}
