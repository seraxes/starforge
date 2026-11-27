import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  statusIdAfterTagSave,
  validateFollowUpTagIds,
  validateTagFields,
} from './tag-catalog-rules'

describe('onboarding tag catalog fields', () => {
  it('refuses an empty tag label', () => {
    const refused = validateTagFields({ label: '   ', color: '#2563eb' })
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /label/i)
  })

  it('accepts label, color, to-do, and fade', () => {
    const ok = validateTagFields({
      label: 'Action required',
      color: '#dc2626',
      todo: true,
      fade: false,
    })
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.values.label, 'Action required')
    assert.equal(ok.values.color, '#dc2626')
    assert.equal(ok.values.todo, true)
    assert.equal(ok.values.fade, false)
  })
})

describe('onboarding tag vs status', () => {
  it('does not change the person status id when a tag is saved', () => {
    const before = 'status_recruiting'
    assert.equal(statusIdAfterTagSave(before, 'tag_waiting'), before)
    assert.equal(statusIdAfterTagSave(before, 'tag_action_required'), before)
    assert.equal(statusIdAfterTagSave(before), before)
  })
})

describe('onboarding follow-up catalog tag ids', () => {
  const catalog = ['tag_waiting', 'tag_on_hold', 'tag_action_required']

  it('accepts a catalog tag id', () => {
    const ok = validateFollowUpTagIds(['tag_waiting', 'tag_action_required'], catalog)
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.deepEqual(ok.tagIds, ['tag_waiting', 'tag_action_required'])
  })

  it('refuses an unknown tag id', () => {
    const refused = validateFollowUpTagIds(['tag_waiting', 'tag_unknown'], catalog)
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /unknown/i)
  })

  it('allows clearing tags', () => {
    const ok = validateFollowUpTagIds([], catalog)
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.deepEqual(ok.tagIds, [])
  })
})
