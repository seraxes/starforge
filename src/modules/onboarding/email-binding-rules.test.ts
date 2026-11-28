import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  validateEmailTemplateBinding,
  validateReminderTemplateBinding,
} from './email-binding-rules'

const KNOWN = new Set(['tpl-known', 'tpl-invite', 'tpl-ridealong'])
const exists = (id: string) => KNOWN.has(id)

describe('onboarding email binding — reminder', () => {
  it('accepts a known template id on a recruiting status', () => {
    const ok = validateReminderTemplateBinding('recruiting', 'tpl-known', exists)
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.value, 'tpl-known')
  })

  it('refuses a reminder binding on a non-recruiting status', () => {
    for (const phase of ['declined', 'inactive', 'active', 'banned'] as const) {
      const refused = validateReminderTemplateBinding(phase, 'tpl-known', exists)
      assert.equal(refused.ok, false, `expected refuse for phase ${phase}`)
      if (refused.ok) return
      assert.match(refused.error, /recruiting/i)
    }
  })

  it('refuses an unknown template id', () => {
    const refused = validateReminderTemplateBinding('recruiting', 'tpl-missing', exists)
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /unknown/i)
  })

  it('clears when the id is empty', () => {
    const cleared = validateReminderTemplateBinding('recruiting', '   ', exists)
    assert.equal(cleared.ok, true)
    if (!cleared.ok) return
    assert.equal(cleared.value, '')

    const onActive = validateReminderTemplateBinding('active', '', exists)
    assert.equal(onActive.ok, true)
    if (!onActive.ok) return
    assert.equal(onActive.value, '')
  })
})

describe('onboarding email binding — invite / event type', () => {
  it('accepts a known invite template id', () => {
    const ok = validateEmailTemplateBinding('tpl-invite', exists, 'Invite template')
    assert.equal(ok.ok, true)
    if (!ok.ok) return
    assert.equal(ok.value, 'tpl-invite')
  })

  it('refuses an unknown event-type template id', () => {
    const refused = validateEmailTemplateBinding('tpl-nope', exists, 'Ride-along template')
    assert.equal(refused.ok, false)
    if (refused.ok) return
    assert.match(refused.error, /unknown/i)
  })

  it('clears when the id is empty', () => {
    const cleared = validateEmailTemplateBinding('', exists)
    assert.equal(cleared.ok, true)
    if (!cleared.ok) return
    assert.equal(cleared.value, '')
  })
})
