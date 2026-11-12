import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assembleSalesBySource,
  chooseSourceBucket,
  paymentSourceContracts,
  sourceModuleLabel,
  type PaymentSourceContract,
  type SalesModuleRef,
} from './sales-by-source'

const now = new Date('2026-11-12T12:00:00.000Z')

const contracts: PaymentSourceContract[] = [
  { sourceModule: 'product:ads', sourceTypes: ['campaign_credit'] },
  { sourceModule: 'product:events', sourceTypes: ['ticket_tier'] },
  { sourceModule: 'product:shop', sourceTypes: ['sku'] },
  { sourceModule: 'product:subscriptions', sourceTypes: ['plan'] },
]

const modules: SalesModuleRef[] = [
  { id: 'product:events', label: 'Events', enabled: true, href: '/admin/events' },
  { id: 'product:subscriptions', label: 'Subscriptions', enabled: false, href: '/admin/subscriptions' },
  { id: 'product:marketplace', label: 'Marketplace', enabled: true, href: '/admin/settings' },
]

describe('paymentSourceContracts', () => {
  it('groups the live Payments contracts by module id', () => {
    const rows = paymentSourceContracts()
    const events = rows.find((row) => row.sourceModule === 'product:events')
    const shop = rows.find((row) => row.sourceModule === 'product:shop')
    assert.ok(events)
    assert.deepEqual(events?.sourceTypes, ['ticket_tier'])
    assert.ok(shop)
    assert.deepEqual(shop?.sourceTypes, ['sku'])
  })
})

describe('sourceModuleLabel', () => {
  it('uses the catalog label, then the id tail', () => {
    assert.equal(sourceModuleLabel('product:events', 'Events'), 'Events')
    assert.equal(sourceModuleLabel('product:custom', ''), 'Custom')
  })
})

describe('assembleSalesBySource', () => {
  it('lists installed contracts and recorded sellers, and keeps uninstalled contracts off', () => {
    const snapshot = assembleSalesBySource({
      now,
      currency: 'huf',
      contracts,
      modules,
      recordedSourceModules: ['product:custom'],
      totals: [
        {
          sourceModule: 'product:events',
          currency: 'HUF',
          grossMinor: 10000,
          priorGrossMinor: 5000,
          orders: 2,
          priorOrders: 1,
          units: 4,
          priorUnits: 1,
        },
        {
          sourceModule: 'product:custom',
          currency: 'EUR',
          grossMinor: 800,
          priorGrossMinor: 0,
          orders: 1,
          priorOrders: 0,
          units: 1,
          priorUnits: 0,
        },
      ],
      site: {
        grossMinor: 10000,
        priorGrossMinor: 5000,
        orders: 2,
        priorOrders: 1,
        units: 4,
        priorUnits: 1,
      },
      months: [{ key: '2026-11', grossMinor: 10000, orders: 2, units: 4 }],
    })

    assert.equal(snapshot.currency, 'HUF')
    assert.equal(snapshot.grossMinor, 10000)
    assert.equal(snapshot.orders, 2)
    assert.equal(snapshot.averageOrderMinor, 5000)
    assert.equal(snapshot.priorAverageOrderMinor, 5000)
    assert.deepEqual(
      snapshot.sources.map((row) => row.sourceModule),
      ['product:events', 'product:custom', 'product:subscriptions'],
    )
    assert.equal(snapshot.sources[0]?.href, '/admin/events')
    assert.equal(snapshot.sources[0]?.enabled, true)
    assert.equal(snapshot.sources[1]?.label, 'Custom')
    assert.equal(snapshot.sources[1]?.currency, 'EUR')
    assert.equal(snapshot.sources[1]?.enabled, null)
    assert.equal(snapshot.sources[2]?.enabled, false)
    assert.equal(snapshot.sources[2]?.grossMinor, 0)
    assert.equal(snapshot.months.length, 6)
    assert.equal(snapshot.months.at(-1)?.grossMinor, 10000)
    assert.equal(snapshot.months[0]?.grossMinor, 0)
  })

  it('prefers site-currency sales over a busier foreign bucket', () => {
    const chosen = chooseSourceBucket(
      [
        {
          sourceModule: 'product:events',
          currency: 'EUR',
          grossMinor: 9000,
          priorGrossMinor: 0,
          orders: 3,
          priorOrders: 0,
          units: 3,
          priorUnits: 0,
        },
        {
          sourceModule: 'product:events',
          currency: 'HUF',
          grossMinor: 1000,
          priorGrossMinor: 0,
          orders: 1,
          priorOrders: 0,
          units: 1,
          priorUnits: 0,
        },
      ],
      'HUF',
    )
    assert.equal(chosen?.currency, 'HUF')
    assert.equal(chosen?.grossMinor, 1000)
  })
})
