import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { moduleToggleOffIds } from '@/core/settings/module-catalog'

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
        features: baseFeatures,
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
    assert.equal(applyModulesActionToggles({ ok: false }, current), null)
    assert.equal(applyModulesActionToggles({ ok: true }, current), null)
  })

  it('allows one module to turn off and refuses a catalog wipe', () => {
    const previous = {
      'product:media': true,
      'product:forms': true,
      'product:payments': true,
      logo: true,
    }
    const oneOff = moduleToggleOffIds(previous, {
      ...previous,
      logo: false,
    })
    assert.deepEqual(oneOff, ['logo'])

    const wiped = moduleToggleOffIds(previous, {
      'product:media': false,
      'product:forms': false,
      'product:payments': false,
      logo: false,
    })
    assert.equal(wiped.length > 1, true)
    assert.deepEqual(wiped, ['logo', 'product:forms', 'product:media', 'product:payments'])
  })

  it('resolves checked from stored toggles over defaults', () => {
    const item = {
      id: 'product:social',
      kind: 'product' as const,
      label: 'Social',
      description: '',
      required: false,
      defaultEnabled: false,
      installed: true as const,
    }
    assert.equal(resolveModuleToggleChecked(item, { 'product:social': true }, baseFeatures), true)
    assert.equal(resolveModuleToggleChecked(item, {}, baseFeatures), false)
  })
})
