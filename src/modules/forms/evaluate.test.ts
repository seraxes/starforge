import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { evaluateAndValidateFields } from './evaluate'
import type { FormFieldDef } from './types'

describe('evaluateAndValidateFields', () => {
  it('requires visible text fields', () => {
    const fields: FormFieldDef[] = [
      { name: 'email', label: 'Email', type: 'email', required: true },
    ]
    const missing = evaluateAndValidateFields(fields, {})
    assert.ok(missing.error)
    const ok = evaluateAndValidateFields(fields, { email: 'a@b.co' })
    assert.equal(ok.error, undefined)
    assert.equal(ok.values.email, 'a@b.co')
  })

  it('applies computed expressions', () => {
    const fields: FormFieldDef[] = [
      { name: 'a', label: 'A', type: 'number' },
      { name: 'b', label: 'B', type: 'number' },
      {
        name: 'total',
        label: 'Total',
        type: 'computed',
        computed: { expression: 'a + b', precision: 0 },
      },
    ]
    const result = evaluateAndValidateFields(fields, { a: '2', b: '5' })
    assert.equal(result.error, undefined)
    assert.equal(result.values.total, '7')
  })

  it('ignores captcha field values (token verified separately)', () => {
    const fields: FormFieldDef[] = [
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'captcha_1', label: 'Captcha', type: 'captcha', required: false },
    ]
    const result = evaluateAndValidateFields(fields, {
      email: 'a@b.co',
      captcha_1: 'should-not-persist',
    })
    assert.equal(result.error, undefined)
    assert.equal(result.values.email, 'a@b.co')
    assert.equal(result.values.captcha_1, '')
    assert.equal(result.required.captcha_1, false)
  })
})
