import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  asModuleSettingsDocument,
  mergeModuleSettingsDocument,
} from './module-settings-document'

describe('module-settings-document', () => {
  it('asModuleSettingsDocument returns {} for non-objects', () => {
    assert.deepEqual(asModuleSettingsDocument(null), {})
    assert.deepEqual(asModuleSettingsDocument(undefined), {})
    assert.deepEqual(asModuleSettingsDocument('x'), {})
    assert.deepEqual(asModuleSettingsDocument([1]), {})
  })

  it('asModuleSettingsDocument shallow-copies plain objects', () => {
    const raw = { a: 1, b: 'two' }
    const out = asModuleSettingsDocument(raw)
    assert.deepEqual(out, raw)
    assert.notEqual(out, raw)
  })

  it('mergeModuleSettingsDocument layers defaults under raw', () => {
    assert.deepEqual(
      mergeModuleSettingsDocument({ a: 1, b: 2 }, { b: 9, c: 3 }),
      { a: 1, b: 9, c: 3 },
    )
    assert.deepEqual(mergeModuleSettingsDocument({ a: 1 }, null), { a: 1 })
  })
})
