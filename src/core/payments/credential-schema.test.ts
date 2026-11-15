import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  credentialWritesFromForm,
  paymentMethodCredentialsReady,
} from './credential-schema'
import type { PaymentMethodDescriptor } from './adapter'

const sample: PaymentMethodDescriptor = {
  id: 'example',
  label: 'Example',
  buyerLabel: 'Example',
  online: true,
  missingReady: 'a secret and a client id are saved',
  webhookMerchantFallback: true,
  webhookGetStatusPeek: false,
  credentialSchema: {
    kinds: [
      { kind: 'example', role: 'primary' },
      { kind: 'example_webhook', role: 'webhookSecret' },
    ],
    fields: [
      {
        name: 'exampleSecret',
        label: 'Secret',
        input: 'secret',
        kind: 'example',
        bind: 'secret',
        requiredForReady: true,
      },
      {
        name: 'exampleClientId',
        label: 'Client id',
        input: 'text',
        kind: 'example',
        bind: 'meta',
        metaKey: 'publicId',
        requiredForReady: true,
      },
      {
        name: 'exampleWebhook',
        label: 'Webhook',
        input: 'secret',
        kind: 'example_webhook',
        bind: 'secret',
        requiredForReady: false,
      },
    ],
  },
}

describe('payment credential schema', () => {
  it('is ready only when every required field is saved', () => {
    assert.equal(
      paymentMethodCredentialsReady(sample, [
        { kind: 'example', hasSecret: true, meta: { publicId: 'id' } },
      ]),
      true,
    )
    assert.equal(
      paymentMethodCredentialsReady(sample, [
        { kind: 'example', hasSecret: true, meta: { publicId: '' } },
      ]),
      false,
    )
    assert.equal(
      paymentMethodCredentialsReady(sample, [
        { kind: 'example', hasSecret: false, meta: { publicId: 'id' } },
        { kind: 'example_webhook', hasSecret: true },
      ]),
      false,
    )
  })

  it('writes only non-empty fields and keeps blank secrets off the payload', () => {
    const writes = credentialWritesFromForm(sample, (name) => {
      if (name === 'exampleClientId') return ' client '
      if (name === 'exampleWebhook') return 'whsec'
      return ''
    })
    assert.deepEqual(writes, [
      { kind: 'example', secretPlain: undefined, meta: { publicId: 'client' } },
      { kind: 'example_webhook', secretPlain: 'whsec', meta: undefined },
    ])
  })
})
