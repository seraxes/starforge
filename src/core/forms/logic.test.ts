import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isFieldRequired, isFieldVisible } from './logic'
import type { FormFieldDef } from './types'

const base: FormFieldDef = {
  name: 'notes',
  label: 'Notes',
  type: 'textarea',
}

describe('form field logic', () => {
  it('hides when showWhen fails', () => {
    const field: FormFieldDef = {
      ...base,
      logic: { showWhen: { logic: 'and', conditions: [{ field: 'kind', op: 'eq', value: 'other' }] } },
    }
    assert.equal(isFieldVisible(field, { kind: 'contact' }), false)
    assert.equal(isFieldVisible(field, { kind: 'other' }), true)
  })

  it('requireWhen overrides static required', () => {
    const field: FormFieldDef = {
      ...base,
      required: false,
      logic: {
        requireWhen: { logic: 'and', conditions: [{ field: 'kind', op: 'eq', value: 'ticket' }] },
      },
    }
    assert.equal(isFieldRequired(field, { kind: 'contact' }), false)
    assert.equal(isFieldRequired(field, { kind: 'ticket' }), true)
  })
})
