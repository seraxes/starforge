import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  evaluateEmailCondition,
  evaluateEmailConditionGroup,
  normalizeEmailConditionGroup,
  resolvePayloadPath,
} from './conditions'

describe('resolvePayloadPath', () => {
  it('walks nested objects', () => {
    assert.equal(resolvePayloadPath({ a: { b: 2 } }, 'a.b'), 2)
    assert.equal(resolvePayloadPath({ payload: { email: 'x@y.z' } }, 'payload.email'), 'x@y.z')
  })

  it('returns undefined for missing paths', () => {
    assert.equal(resolvePayloadPath({}, 'a.b'), undefined)
    assert.equal(resolvePayloadPath({ a: 1 }, 'a.b'), undefined)
  })
})

describe('evaluateEmailCondition', () => {
  const payload = {
    notifyAdmin: true,
    notifyRespondent: false,
    preset: 'contact',
    formTitle: 'Contact us',
    adminEmails: ['a@b.c'],
  }

  it('supports truthy / falsy / exists', () => {
    assert.equal(
      evaluateEmailCondition({ path: 'notifyAdmin', op: 'truthy' }, payload),
      true,
    )
    assert.equal(
      evaluateEmailCondition({ path: 'notifyRespondent', op: 'falsy' }, payload),
      true,
    )
    assert.equal(
      evaluateEmailCondition({ path: 'missing', op: 'exists' }, payload),
      false,
    )
    assert.equal(
      evaluateEmailCondition({ path: 'preset', op: 'exists' }, payload),
      true,
    )
  })

  it('supports eq / neq / contains', () => {
    assert.equal(
      evaluateEmailCondition({ path: 'preset', op: 'eq', value: 'contact' }, payload),
      true,
    )
    assert.equal(
      evaluateEmailCondition({ path: 'preset', op: 'neq', value: 'survey' }, payload),
      true,
    )
    assert.equal(
      evaluateEmailCondition(
        { path: 'formTitle', op: 'contains', value: 'Contact' },
        payload,
      ),
      true,
    )
  })
})

describe('evaluateEmailConditionGroup', () => {
  it('ANDs conditions; empty group passes', () => {
    assert.equal(evaluateEmailConditionGroup({ all: [] }, {}), true)
    assert.equal(evaluateEmailConditionGroup(undefined, {}), true)
    assert.equal(
      evaluateEmailConditionGroup(
        {
          all: [
            { path: 'a', op: 'truthy' },
            { path: 'b', op: 'eq', value: '1' },
          ],
        },
        { a: true, b: '1' },
      ),
      true,
    )
    assert.equal(
      evaluateEmailConditionGroup(
        {
          all: [
            { path: 'a', op: 'truthy' },
            { path: 'b', op: 'eq', value: '1' },
          ],
        },
        { a: true, b: '2' },
      ),
      false,
    )
  })

  it('normalizes loose JSON', () => {
    const group = normalizeEmailConditionGroup({
      all: [{ path: ' x ', op: 'truthy' }, { path: '', op: 'eq' }, null],
    })
    assert.equal(group.all?.length, 1)
    assert.equal(group.all?.[0]?.path, 'x')
  })
})
