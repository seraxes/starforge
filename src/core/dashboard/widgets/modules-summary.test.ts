import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { summarizeModuleCatalog } from './modules-summary'

describe('modules summary', () => {
  it('counts enabled, allowlisted, and disabled', () => {
    assert.deepEqual(
      summarizeModuleCatalog([
        { enabled: true },
        { enabled: false },
        { enabled: true },
      ]),
      { enabled: 2, allowlisted: 3, disabled: 1 },
    )
    assert.deepEqual(summarizeModuleCatalog([]), {
      enabled: 0,
      allowlisted: 0,
      disabled: 0,
    })
  })
})
