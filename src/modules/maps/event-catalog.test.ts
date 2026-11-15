import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'

import {
  listEventCatalog,
  registerEventCatalog,
  registerRoomRosterSeeder,
  seedRoomRosterFromEvent,
  type EventCatalog,
} from './event-catalog'

const emptyCatalog: EventCatalog = {
  async listPublishedVenues() {
    return []
  },
  async listEventsForAdmin() {
    return []
  },
  async findEventForAdmin() {
    return null
  },
  async listRoster() {
    return []
  },
}

after(() => {
  registerEventCatalog(emptyCatalog)
  registerRoomRosterSeeder(null)
})

describe('event catalog slot', () => {
  it('starts empty and a later register replaces the previous catalog', async () => {
    registerEventCatalog(emptyCatalog)
    const first = listEventCatalog()
    assert.deepEqual(await first.listEventsForAdmin(), [])
    assert.equal(await first.findEventForAdmin('missing'), null)
    assert.deepEqual(await first.listPublishedVenues(), [])
    assert.deepEqual(await first.listRoster('event-1'), [])

    const marker = { id: 'venue-1', lat: 47.5, lng: 19.0, label: 'Field' }
    registerEventCatalog({
      async listPublishedVenues() {
        return [marker]
      },
      async listEventsForAdmin() {
        return [{ id: 'event-1', label: 'Game (published)' }]
      },
      async findEventForAdmin(id) {
        return id === 'event-1' ? { id, label: 'Game' } : null
      },
      async listRoster() {
        return [{ userId: 'user-1', ticketTierId: 'tier-1', status: 'registered' }]
      },
    })

    const registered = listEventCatalog()
    assert.deepEqual(await registered.listPublishedVenues(), [marker])
    assert.deepEqual(await registered.listEventsForAdmin(), [
      { id: 'event-1', label: 'Game (published)' },
    ])
    assert.deepEqual(await registered.findEventForAdmin('event-1'), {
      id: 'event-1',
      label: 'Game',
    })
    assert.deepEqual(await registered.listRoster('event-1'), [
      { userId: 'user-1', ticketTierId: 'tier-1', status: 'registered' },
    ])
  })

  it('seeds nothing until Events registers a seeder', async () => {
    registerRoomRosterSeeder(null)
    assert.deepEqual(await seedRoomRosterFromEvent('room-1', 'event-1'), {
      teamsCreated: 0,
      membersAdded: 0,
    })

    registerRoomRosterSeeder(async () => ({ teamsCreated: 2, membersAdded: 5 }))
    assert.deepEqual(await seedRoomRosterFromEvent('room-1', 'event-1'), {
      teamsCreated: 2,
      membersAdded: 5,
    })
  })
})
