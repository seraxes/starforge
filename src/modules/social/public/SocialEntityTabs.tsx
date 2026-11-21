import Link from 'next/link'
import React from 'react'

type EntityTab = 'wall' | 'calendar'

/** Wall / Calendar tabs. Calendar is omitted when Events is off. */
export function SocialEntityTabs({
  wallHref,
  calendarHref,
  active,
  showCalendar,
}: {
  wallHref: string
  calendarHref: string
  active: EntityTab
  showCalendar: boolean
}) {
  return (
    <nav className="sf-social-entity-tabs admin-control-row" aria-label="Group or page tabs">
      <Link
        className={active === 'wall' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'}
        href={wallHref}
        aria-current={active === 'wall' ? 'page' : undefined}
      >
        Wall
      </Link>
      {showCalendar ? (
        <Link
          className={
            active === 'calendar' ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
          }
          href={calendarHref}
          aria-current={active === 'calendar' ? 'page' : undefined}
        >
          Calendar
        </Link>
      ) : null}
    </nav>
  )
}
