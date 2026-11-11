import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  availableUniqueFormFieldTemplates,
  createUniqueFormFieldDraft,
  listUniqueFormFieldTemplates,
  resolveFormFieldUniqueKey,
  usedUniqueFormFieldKeys,
} from './unique-fields'
import type { FormFieldDef } from './types'

describe('unique form fields', () => {
  it('lists profile templates with stable unique keys', () => {
    const list = listUniqueFormFieldTemplates('profiles')
    assert.ok(list.length >= 10)
    assert.ok(list.every((t) => t.uniqueKey.startsWith('profile:')))
    assert.equal(list[0]!.createDraft().uniqueKey, list[0]!.uniqueKey)
  })

  it('hides used unique keys from the available palette', () => {
    const draft = createUniqueFormFieldDraft('profile:display_name')
    assert.ok(draft)
    const fields: FormFieldDef[] = [draft!]
    const used = usedUniqueFormFieldKeys(fields)
    assert.equal(used.has('profile:display_name'), true)
    const available = availableUniqueFormFieldTemplates(fields, 'profiles')
    assert.equal(
      available.some((t) => t.uniqueKey === 'profile:display_name'),
      false,
    )
    assert.ok(available.some((t) => t.uniqueKey === 'profile:bio'))
  })

  it('backfills uniqueKey from known profile names', () => {
    assert.equal(
      resolveFormFieldUniqueKey({ name: 'display_name' }),
      'profile:display_name',
    )
    assert.equal(resolveFormFieldUniqueKey({ name: 'message' }), null)
  })
})
