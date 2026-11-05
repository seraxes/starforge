import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { matchEmailRulesForTrigger } from './rule-match'

describe('matchEmailRulesForTrigger', () => {
  const rules = [
    {
      id: 'r1',
      enabled: true,
      triggerKey: 'product:forms/submitted',
      mode: 'conditional' as const,
      conditions: { all: [{ path: 'notifyAdmin', op: 'truthy' as const }] },
    },
    {
      id: 'r2',
      enabled: true,
      triggerKey: 'product:forms/submitted',
      mode: 'conditional' as const,
      conditions: { all: [{ path: 'notifyRespondent', op: 'truthy' as const }] },
    },
    {
      id: 'r3',
      enabled: false,
      triggerKey: 'product:forms/submitted',
      mode: 'automatic' as const,
      conditions: { all: [] },
    },
    {
      id: 'r4',
      enabled: true,
      triggerKey: 'system:test',
      mode: 'automatic' as const,
      conditions: { all: [] },
    },
  ]

  it('matches enabled rules for the trigger whose conditions pass', () => {
    const matched = matchEmailRulesForTrigger({
      rules,
      triggerKey: 'product:forms/submitted',
      payload: { notifyAdmin: true, notifyRespondent: false },
    })
    assert.deepEqual(
      matched.map((r) => r.id),
      ['r1'],
    )
  })

  it('can match multiple rules', () => {
    const matched = matchEmailRulesForTrigger({
      rules,
      triggerKey: 'product:forms/submitted',
      payload: { notifyAdmin: true, notifyRespondent: true },
    })
    assert.deepEqual(
      matched.map((r) => r.id).sort(),
      ['r1', 'r2'],
    )
  })

  it('ignores other triggers and disabled rules', () => {
    const matched = matchEmailRulesForTrigger({
      rules,
      triggerKey: 'system:test',
      payload: {},
    })
    assert.deepEqual(
      matched.map((r) => r.id),
      ['r4'],
    )
  })

  it('returns empty for unknown trigger', () => {
    assert.deepEqual(
      matchEmailRulesForTrigger({
        rules,
        triggerKey: 'nope',
        payload: {},
      }),
      [],
    )
  })
})
