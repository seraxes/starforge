import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createPaymentsProvider,
  getPaymentMethodAdapter,
  getPaymentsProvider,
  getPaymentsProviderForMethod,
  listOnlinePaymentMethodIds,
  paymentsProviderEnvOptions,
  registerPaymentMethodAdapter,
} from './adapter'
import './register-online'
import type { PaymentsProvider } from './types'

function sentinel(id: string): PaymentsProvider {
  return {
    async createIntent() {
      return { ok: true, provider: id }
    },
    async verifyIntent(providerRef: string) {
      return { ok: true, status: 'succeeded', providerRef }
    },
    info() {
      return { provider: id, label: id, enabled: true, ready: true }
    },
  }
}

describe('online payment adapter registry', () => {
  it('registers Barion, Stripe, and PayPal in that order', () => {
    const ids = listOnlinePaymentMethodIds()
    assert.deepEqual(ids.slice(0, 3), ['barion', 'stripe', 'paypal'])
    assert.equal(getPaymentMethodAdapter('stripe')?.webhookMerchantFallback, true)
    assert.equal(getPaymentMethodAdapter('stripe')?.webhookGetStatusPeek, false)
    assert.equal(getPaymentMethodAdapter('paypal')?.webhookMerchantFallback, true)
    assert.equal(getPaymentMethodAdapter('barion')?.webhookMerchantFallback, false)
    assert.equal(getPaymentMethodAdapter('barion')?.webhookGetStatusPeek, true)
    assert.equal(getPaymentMethodAdapter('barion')?.buyerLabel, 'Barion')
    assert.equal(getPaymentMethodAdapter('stripe')?.buyerLabel, 'Card (Stripe)')
  })

  it('builds providers from the registry, including a newly registered gateway', () => {
    registerPaymentMethodAdapter({
      id: 'registry_probe',
      label: 'Registry probe',
      buyerLabel: 'Registry probe',
      online: true,
      missingReady: 'a secret is saved',
      webhookMerchantFallback: false,
      webhookGetStatusPeek: false,
      credentialSchema: {
        kinds: [{ kind: 'registry_probe', role: 'primary' }],
        fields: [
          {
            name: 'registryProbeSecret',
            label: 'Secret',
            input: 'secret',
            kind: 'registry_probe',
            bind: 'secret',
            requiredForReady: true,
          },
        ],
      },
      createProvider: () => sentinel('registry_probe'),
    })

    assert.equal(
      createPaymentsProvider({ provider: 'registry_probe', enabled: true }).info().provider,
      'registry_probe',
    )
    assert.equal(getPaymentsProvider('registry_probe').info().provider, 'registry_probe')
    assert.equal(getPaymentsProviderForMethod('registry_probe').info().provider, 'registry_probe')
    assert.equal(
      createPaymentsProvider({ provider: 'registry_probe', enabled: false }).info().provider,
      'noop',
    )
    assert.equal(getPaymentsProviderForMethod('bank_transfer').info().provider, 'manual')
    assert.equal(getPaymentsProviderForMethod('not-a-gateway').info().provider, 'manual')
    assert.equal(getPaymentsProvider('not-a-gateway').info().provider, 'manual')
    assert.equal(createPaymentsProvider({ provider: 'manual', enabled: true }).info().provider, 'manual')
    assert.equal(createPaymentsProvider({ provider: 'noop', enabled: true }).info().provider, 'noop')
    assert.equal(getPaymentsProvider('barion').info().provider, 'barion')
    assert.equal(getPaymentsProvider('stripe').info().label, 'Stripe')
    assert.equal(getPaymentsProvider('paypal').info().label, 'PayPal')
    const choices = paymentsProviderEnvOptions().map((option) => option.value)
    assert.deepEqual(choices.slice(0, 4), ['', 'noop', 'manual', 'barion'])
    assert.ok(choices.includes('stripe'))
    assert.ok(choices.includes('paypal'))
    assert.ok(choices.includes('registry_probe'))
  })
})
