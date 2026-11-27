import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  filterDashboardTilesForViewer,
  isDashboardTileVisibleForViewer,
  validateDashboardTileFields,
} from './dashboard-tile-rules'

describe('onboarding dashboard tile visibility', () => {
  const recruiting = 'status_recruiting'
  const active = 'status_active'

  it('hides a tile limited to one status when the person is on another status', () => {
    const tile = {
      published: true,
      statusIds: [recruiting],
      staffOnly: false,
    }
    assert.equal(isDashboardTileVisibleForViewer(tile, active, false), false)
    assert.equal(isDashboardTileVisibleForViewer(tile, recruiting, false), true)
  })

  it('shows a tile with an empty status list for every status', () => {
    const tile = {
      published: true,
      statusIds: [] as string[],
      staffOnly: false,
    }
    assert.equal(isDashboardTileVisibleForViewer(tile, recruiting, false), true)
    assert.equal(isDashboardTileVisibleForViewer(tile, active, false), true)
  })

  it('hides an unpublished tile', () => {
    const tile = {
      published: false,
      statusIds: [] as string[],
      staffOnly: false,
    }
    assert.equal(isDashboardTileVisibleForViewer(tile, recruiting, false), false)
    assert.equal(isDashboardTileVisibleForViewer(tile, recruiting, true), false)
  })

  it('filters a mixed list by status and published', () => {
    const tiles = [
      { id: 'a', published: true, statusIds: [recruiting], staffOnly: false },
      { id: 'b', published: true, statusIds: [] as string[], staffOnly: false },
      { id: 'c', published: false, statusIds: [] as string[], staffOnly: false },
      { id: 'd', published: true, statusIds: [active], staffOnly: false },
    ]
    const visible = filterDashboardTilesForViewer(tiles, recruiting, false)
    assert.deepEqual(
      visible.map((row) => row.id),
      ['a', 'b'],
    )
  })
})

describe('onboarding dashboard tile fields', () => {
  it('refuses an empty title', () => {
    const refused = validateDashboardTileFields({ title: '   ', url: '/booking' })
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /title/i)
  })

  it('accepts title, icon, url, published, status ids, and staff-only', () => {
    const ok = validateDashboardTileFields({
      title: 'Book exam',
      icon: 'calendar',
      url: '/exam',
      published: true,
      statusIds: ['status_recruiting'],
      staffOnly: false,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.title, 'Book exam')
    assert.equal(ok.values.icon, 'calendar')
    assert.equal(ok.values.url, '/exam')
    assert.equal(ok.values.published, true)
    assert.deepEqual(ok.values.statusIds, ['status_recruiting'])
    assert.equal(ok.values.staffOnly, false)
  })
})
