import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildFactionRosterRows } from './seed-map-room-rows'

describe('buildFactionRosterRows', () => {
  it('builds one team per faction and keeps registered and waitlisted users', () => {
    const rows = buildFactionRosterRows(
      [
        { id: 'general-1', title: 'General', sortOrder: 0, kind: 'general' },
        { id: 'blue', title: 'Blue', sortOrder: 2, kind: 'faction' },
        { id: 'red', title: '', sortOrder: 4, kind: 'faction' },
      ],
      [
        { userId: 'u1', ticketTierId: 'blue', status: 'registered' },
        { userId: ' u2 ', ticketTierId: 'blue', status: 'waitlisted' },
        { userId: 'u3', ticketTierId: 'blue', status: 'pending' },
        { userId: 'u4', ticketTierId: 'general-1', status: 'registered' },
        { userId: '', ticketTierId: 'red', status: 'registered' },
        { userId: 'u5', ticketTierId: 'red', status: 'cancelled' },
        { userId: 'u6', ticketTierId: 'red', status: 'registered' },
      ],
    )

    assert.deepEqual(rows, [
      {
        ticketTierId: 'blue',
        name: 'Blue',
        sortOrder: 2,
        userIds: ['u1', 'u2'],
      },
      {
        ticketTierId: 'red',
        name: 'Team 2',
        sortOrder: 4,
        userIds: ['u6'],
      },
    ])
  })

  it('returns no rows when the event has no factions', () => {
    assert.deepEqual(
      buildFactionRosterRows(
        [{ id: 'general-1', title: 'General', sortOrder: 0, kind: 'general' }],
        [{ userId: 'u1', ticketTierId: 'general-1', status: 'registered' }],
      ),
      [],
    )
  })
})