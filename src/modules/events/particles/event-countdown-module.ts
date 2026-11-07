import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import {
  viewerPassesEventAcl,
  viewerPassesEventPassword,
} from '../public-access'
import { EventCountdown } from '../public/EventCountdown'
import { findPublishedEventByPublicKey } from '../store'
import { readEventCountdownConfig } from './event-countdown-config'

/**
 * event-countdown particle — live countdown to a published event start.
 */
export const eventCountdownModule: StarforgeModule = {
  id: 'event-countdown',
  name: 'Event countdown',
  description: 'Countdown to a published event start (bind id or slug).',
  defaultWidth: 50,
  navViews: [{ key: 'events', label: 'Events', href: '/events' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
      return null
    }

    const cfg = readEventCountdownConfig(slot.config)
    if (!cfg.eventKey) {
      return React.createElement(
        'p',
        { className: 'sf-event-countdown-empty' },
        'Select an event id or slug in the particle settings.',
      )
    }

    const event = await findPublishedEventByPublicKey(cfg.eventKey)
    if (!event?.startsAt) {
      return React.createElement(
        'p',
        { className: 'sf-event-countdown-empty' },
        'Event not found or has no start time.',
      )
    }

    const viewer = await getAccessViewer()
    if (!viewerPassesEventAcl(event, viewer)) {
      return null
    }
    if (!(await viewerPassesEventPassword(event, viewer))) {
      return null
    }

    return React.createElement(EventCountdown, {
      startsAt: event.startsAt.toISOString(),
      title: cfg.showTitle ? event.title : undefined,
    })
  },
}
