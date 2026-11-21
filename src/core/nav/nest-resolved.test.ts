import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { nestResolvedNavItems } from './document'

type NestLeaf = {
  id: string
  label: string
  href: string
  children?: NestLeaf[]
}

function leaf(id: string, label: string, href: string): NestLeaf {
  return { id, label, href }
}

describe('nestResolvedNavItems', () => {
  it('nests children under a resolved parent and keeps sibling order', () => {
    const roots = nestResolvedNavItems([
      { parentId: null, resolved: leaf('p', 'Social', '/feed') },
      { parentId: 'p', resolved: leaf('c1', 'People', '/feed/people') },
      { parentId: 'p', resolved: leaf('c2', 'Groups', '/feed/groups') },
      { parentId: null, resolved: leaf('e', 'Events', '/events') },
    ])

    assert.equal(roots.length, 2)
    assert.equal(roots[0]?.label, 'Social')
    assert.deepEqual(
      roots[0]?.children?.map((c) => c.label),
      ['People', 'Groups'],
    )
    assert.equal(roots[1]?.label, 'Events')
    assert.equal(roots[1]?.children, undefined)
  })

  it('promotes orphans whose parent did not resolve', () => {
    const roots = nestResolvedNavItems([
      { parentId: 'missing', resolved: leaf('c', 'People', '/feed/people') },
    ])
    assert.equal(roots.length, 1)
    assert.equal(roots[0]?.label, 'People')
    assert.equal(roots[0]?.children, undefined)
  })
})
