import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { orderModuleBoot, type BootOrderNode } from './boot-order'

function boot(id: string, layer: BootOrderNode['layer'], requires?: string[]): BootOrderNode {
  return {
    id,
    layer,
    requires,
    boot: { importPath: `@/modules/${id}/boot`, exportName: 'bootPack' },
  }
}

describe('orderModuleBoot', () => {
  it('orders Stage 6 packs by layer, then requires, then id', () => {
    const ordered = orderModuleBoot([
      { id: 'product:media', layer: 'base' },
      { id: 'product:forms', layer: 'base', requires: ['product:media'] },
      { id: 'product:rich-editor', layer: 'base', requires: ['product:media'] },
      {
        id: 'product:email-manager',
        layer: 'base',
        requires: ['product:rich-editor', 'product:media'],
        boot: {
          importPath: 'pack-boot:email-manager',
          exportName: 'bootEmailManager',
        },
      },
      { id: 'product:payments', layer: 'base', requires: ['product:email-manager'] },
      {
        id: 'product:profiles',
        layer: 'base',
        requires: ['product:media', 'product:forms'],
        boot: { importPath: 'pack-boot:profiles', exportName: 'bootProfiles' },
      },
      { id: 'product:maps', layer: 'base', requires: ['product:media'] },
      {
        id: 'product:events',
        layer: 'advanced',
        requires: [
          'product:forms',
          'product:media',
          'product:rich-editor',
          'product:payments',
          'product:profiles',
          'product:maps',
        ],
        boot: { importPath: 'pack-boot:events', exportName: 'bootEvents' },
      },
      {
        id: 'product:subscriptions',
        layer: 'advanced',
        requires: [
          'product:payments',
          'product:email-manager',
          'product:forms',
          'product:profiles',
        ],
        boot: {
          importPath: 'pack-boot:subscriptions',
          exportName: 'bootSubscriptions',
        },
      },
    ])

    assert.deepEqual(
      ordered.map((entry) => entry.id),
      [
        'product:email-manager',
        'product:profiles',
        'product:events',
        'product:subscriptions',
      ],
    )
    assert.deepEqual(
      ordered.map((entry) => entry.exportName),
      ['bootEmailManager', 'bootProfiles', 'bootEvents', 'bootSubscriptions'],
    )
  })

  it('puts base before site before advanced even when ids sort the other way', () => {
    const ordered = orderModuleBoot([
      boot('a-advanced', 'advanced'),
      boot('m-site', 'site'),
      boot('z-base', 'base'),
    ])
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      ['z-base', 'm-site', 'a-advanced'],
    )
  })

  it('puts a required boot module first inside a layer, ahead of id order', () => {
    const ordered = orderModuleBoot([
      boot('product:aaa', 'advanced', ['product:zzz']),
      boot('product:zzz', 'advanced'),
    ])
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      ['product:zzz', 'product:aaa'],
    )
  })

  it('follows requires through a module that does not boot', () => {
    const ordered = orderModuleBoot([
      boot('child', 'base', ['mid']),
      { id: 'mid', layer: 'base', requires: ['parent'] },
      boot('parent', 'base'),
    ])
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      ['parent', 'child'],
    )
  })

  it('ignores optionalRequires', () => {
    const dependent: BootOrderNode & { optionalRequires?: string[] } = {
      id: 'product:aaa',
      layer: 'advanced',
      requires: [],
      optionalRequires: ['product:zzz'],
      boot: { importPath: '@/a', exportName: 'bootA' },
    }
    const ordered = orderModuleBoot([dependent, boot('product:zzz', 'advanced')])
    assert.deepEqual(
      ordered.map((entry) => entry.id),
      ['product:aaa', 'product:zzz'],
    )
  })

  it('rejects a boot cycle', () => {
    assert.throws(
      () =>
        orderModuleBoot([
          boot('a', 'base', ['b']),
          boot('b', 'base', ['a']),
        ]),
      /Cyclic boot order/,
    )
  })

  it('rejects a boot dependency in a later layer', () => {
    assert.throws(
      () =>
        orderModuleBoot([
          boot('product:base-pack', 'base', ['product:advanced-pack']),
          boot('product:advanced-pack', 'advanced'),
        ]),
      /later layer/,
    )
  })

  it('rejects a boot declaration without a layer', () => {
    assert.throws(
      () =>
        orderModuleBoot([
          {
            id: 'product:loose',
            boot: { importPath: '@/modules/loose/boot', exportName: 'bootLoose' },
          },
        ]),
      /must set layer/,
    )
  })
})
