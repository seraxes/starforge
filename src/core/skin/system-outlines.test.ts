import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  STARFORGE_PASTEL_NOT_FOUND_OUTLINE_ID,
  STARFORGE_PASTEL_OFFLINE_OUTLINE_ID,
  STARFORGE_PASTEL_SKIN_ID,
} from './registry'
import { skinSystemOutlineId } from './system-outline-ids'

describe('skin system outlines', () => {
  it('builds offline and not-found ids from the skin id', () => {
    assert.equal(skinSystemOutlineId(STARFORGE_PASTEL_SKIN_ID, 'offline'), STARFORGE_PASTEL_OFFLINE_OUTLINE_ID)
    assert.equal(
      skinSystemOutlineId(STARFORGE_PASTEL_SKIN_ID, 'not-found'),
      STARFORGE_PASTEL_NOT_FOUND_OUTLINE_ID,
    )
    assert.equal(skinSystemOutlineId('acme-brand', 'offline'), 'acme-brand-offline')
    assert.equal(skinSystemOutlineId('acme-brand', 'not-found'), 'acme-brand-not-found')
  })

  it('falls back to Pastel system ids when skin id is empty', () => {
    assert.equal(skinSystemOutlineId('', 'offline'), STARFORGE_PASTEL_OFFLINE_OUTLINE_ID)
    assert.equal(skinSystemOutlineId('  ', 'not-found'), STARFORGE_PASTEL_NOT_FOUND_OUTLINE_ID)
  })
})
