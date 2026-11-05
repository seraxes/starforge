import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CATALOG_DEFAULTS_REPAIR_MARKER,
  mergeMissingCatalogModuleDefaults,
  repairCatalogModuleDefaultsOnce,
} from './module-catalog'
import { MODULE_IDS } from './module-toggles'

describe('catalog module toggle defaults', () => {
  it('backfills missing defaultEnabled product ids as true', () => {
    const { toggles, changed } = mergeMissingCatalogModuleDefaults({})
    assert.equal(changed, true)
    assert.equal(toggles[MODULE_IDS.emailManager], true)
    assert.equal(toggles[MODULE_IDS.forms], true)
    assert.equal(toggles[MODULE_IDS.media], true)
    // Opt-in later packs stay unset when defaultEnabled is false.
    assert.equal(typeof toggles[MODULE_IDS.posts], 'undefined')
  })

  it('one-shot repair re-enables wiped Email Manager then respects later off', () => {
    const wiped = {
      [MODULE_IDS.emailManager]: false,
      [MODULE_IDS.forms]: false,
      [MODULE_IDS.redirects]: true,
    }
    const first = repairCatalogModuleDefaultsOnce(wiped)
    assert.equal(first.changed, true)
    assert.equal(first.toggles[MODULE_IDS.emailManager], true)
    assert.equal(first.toggles[MODULE_IDS.forms], true)
    assert.equal(first.toggles[CATALOG_DEFAULTS_REPAIR_MARKER], true)

    const afterOperatorOff = {
      ...first.toggles,
      [MODULE_IDS.emailManager]: false,
    }
    const second = repairCatalogModuleDefaultsOnce(afterOperatorOff)
    assert.equal(second.changed, false)
    assert.equal(second.toggles[MODULE_IDS.emailManager], false)
  })
})
