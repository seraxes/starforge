import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  merchantMethodReady,
  offeredMerchantMethods,
  parseMerchantEnabledMethods,
} from './merchant-methods'

const empty = { bankIban: '', entranceInstructions: '', cashInstructions: '' }

describe('merchant payment method offer', () => {
  it('keeps only known method ids', () => {
    assert.deepEqual(parseMerchantEnabledMethods(['barion', 'nope', 'cash', 'cash']), [
      'barion',
      'cash',
    ])
  })

  it('offers a method only when the switch is on and the block is filled', () => {
    const profile = {
      bankIban: 'HU00',
      entranceInstructions: '',
      cashInstructions: 'Pay the desk',
    }
    const credentials = [
      { kind: 'barion', hasSecret: true },
      { kind: 'paypal', hasSecret: true, meta: { publicId: '' } },
      { kind: 'stripe', hasSecret: false },
    ]
    assert.equal(merchantMethodReady('bank_transfer', profile, credentials), true)
    assert.equal(merchantMethodReady('pay_at_entrance', profile, credentials), false)
    assert.equal(merchantMethodReady('paypal', profile, credentials), false)
    assert.equal(
      merchantMethodReady('stripe', profile, [{ kind: 'stripe', hasSecret: true }]),
      true,
    )
    assert.equal(
      merchantMethodReady('stripe', profile, [{ kind: 'stripe_webhook', hasSecret: true }]),
      false,
    )
    assert.deepEqual(
      offeredMerchantMethods(
        ['bank_transfer', 'pay_at_entrance', 'cash', 'barion', 'stripe', 'paypal'],
        profile,
        credentials,
      ),
      ['bank_transfer', 'cash', 'barion'],
    )
  })

  it('offers nothing when every switch is off', () => {
    assert.deepEqual(
      offeredMerchantMethods([], { ...empty, bankIban: 'HU00' }, [
        { kind: 'barion', hasSecret: true },
      ]),
      [],
    )
  })
})
