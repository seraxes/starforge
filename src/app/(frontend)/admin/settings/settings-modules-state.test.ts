import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyModulesActionToggles,
  moduleTogglesSignature,
  resolveModuleToggleChecked,
} from './settings-modules-state'

const baseFeatures = {
  registration: true,
  richEditor: true,
  posts: false,
  modules: false,
  draftPreview: false,
}

describe('settings modules toggle UI state', () => {
  it('remount signature changes when a toggle flips', () => {
    const before = moduleTogglesSignature({ 'product:social': false, 'product:media': true })
    const after = moduleTogglesSignature({ 'product:social': true, 'product:media': true })
    assert.notEqual(before, after)
  })

  it('applies action-returned toggles including auto-enabled requires (success path)', () => {
    const current = {
      moduleToggles: { 'product:social': false, 'product:media': true },
      features: baseFeatures,
    }
    const next = applyModulesActionToggles(
      {
        ok: true,
        moduleToggles: {
          'product:social': true,
          'product:media': true,
          'product:forms': true,
        },
        features: { ...baseFeatures, forms: true },
      },
      current,
    )
    assert.ok(next)
    assert.equal(next.moduleToggles['product:social'], true)
    assert.equal(next.moduleToggles['product:forms'], true)
    assert.notEqual(
      moduleTogglesSignature(current.moduleToggles),
      moduleTogglesSignature(next.moduleToggles),
    )
  })

  it('keeps last known toggles when the action errors (failure path)', () => {
    const current = {
      moduleToggles: { 'product:social': false },
      features: baseFeatures,
    }
    assert.equal(applyModulesActionToggles({ error: 'refused' }, current), null)
    assert.equal(applyModulesActionToggles({ ok: true }, current), null)
  })

  it('resolves checked from stored toggles over defaults', () => {
    const item = {
      id: 'product:social',
      kind: 'product' as const,
      label: 'Social',
      description: '',
      required: false,
      defaultEnabled: false,
    }
    assert.equal(resolveModuleToggleChecked(item, { 'product:social': true }, baseFeatures), true)
    assert.equal(resolveModuleToggleChecked(item, {}, baseFeatures), false)
  })
})
