import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { mapTeamChannel, parseMapTeamChannel } from './channels'

describe('map team channels', () => {
  it('round-trips room and team ids', () => {
    const channel = mapTeamChannel('room-1', 'team-2')
    assert.equal(channel, 'map:room:room-1:team:team-2')
    assert.deepEqual(parseMapTeamChannel(channel), {
      roomId: 'room-1',
      teamId: 'team-2',
    })
  })

  it('rejects malformed channels', () => {
    assert.equal(parseMapTeamChannel('user:abc'), null)
    assert.equal(parseMapTeamChannel('map:room:only'), null)
    assert.equal(parseMapTeamChannel('map:room::team:x'), null)
  })
})
