import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MAX_GROUP_DEPTH,
  depthUnderParent,
  expandGroupIdsWithAncestors,
  groupDepth,
  maxRelativeSubtreeDepth,
  orderGroupsAsTree,
  wouldCreateCycle,
} from './hierarchy'

function parentMap(
  entries: Array<[string, string | null]>,
): Map<string, string | null> {
  return new Map(entries)
}

describe('expandGroupIdsWithAncestors', () => {
  it('returns direct ids when groups are roots', () => {
    const parents = parentMap([
      ['editors', null],
      ['staff', null],
    ])
    assert.deepEqual(expandGroupIdsWithAncestors(['editors'], parents), ['editors'])
  })

  it('walks up the parent chain', () => {
    const parents = parentMap([
      ['site', null],
      ['staff', 'site'],
      ['editors', 'staff'],
    ])
    assert.deepEqual(expandGroupIdsWithAncestors(['editors'], parents), [
      'editors',
      'staff',
      'site',
    ])
  })

  it('dedupes when multiple directs share ancestors', () => {
    const parents = parentMap([
      ['staff', null],
      ['editors', 'staff'],
      ['mods', 'staff'],
    ])
    assert.deepEqual(expandGroupIdsWithAncestors(['editors', 'mods'], parents), [
      'editors',
      'mods',
      'staff',
    ])
  })
})

describe('wouldCreateCycle / depth', () => {
  const parents = parentMap([
    ['a', null],
    ['b', 'a'],
    ['c', 'b'],
  ])

  it('detects self and descendant parents as cycles', () => {
    assert.equal(wouldCreateCycle('b', 'b', parents), true)
    assert.equal(wouldCreateCycle('a', 'c', parents), true)
    assert.equal(wouldCreateCycle('c', 'a', parents), false)
  })

  it('computes depth and depth under parent', () => {
    assert.equal(groupDepth('a', parents), 0)
    assert.equal(groupDepth('c', parents), 2)
    assert.equal(depthUnderParent(null, parents), 0)
    assert.equal(depthUnderParent('c', parents), 3)
  })

  it('rejects nesting past MAX_GROUP_DEPTH', () => {
    const chain: Array<[string, string | null]> = [['g0', null]]
    for (let i = 1; i <= MAX_GROUP_DEPTH; i += 1) {
      chain.push([`g${i}`, `g${i - 1}`])
    }
    const deep = parentMap(chain)
    assert.equal(depthUnderParent(`g${MAX_GROUP_DEPTH}`, deep) > MAX_GROUP_DEPTH, true)
  })

  it('maxRelativeSubtreeDepth includes deepest child', () => {
    assert.equal(maxRelativeSubtreeDepth('a', parents), 2)
    assert.equal(maxRelativeSubtreeDepth('c', parents), 0)
  })
})

describe('orderGroupsAsTree', () => {
  it('orders roots then children by label', () => {
    const ordered = orderGroupsAsTree([
      { id: 'editors', label: 'Editors', parentId: 'staff' },
      { id: 'staff', label: 'Staff', parentId: null },
      { id: 'managers', label: 'Managers', parentId: null },
      { id: 'mods', label: 'Mods', parentId: 'staff' },
    ])
    assert.deepEqual(
      ordered.map((r) => ({ id: r.id, depth: r.depth })),
      [
        { id: 'managers', depth: 0 },
        { id: 'staff', depth: 0 },
        { id: 'editors', depth: 1 },
        { id: 'mods', depth: 1 },
      ],
    )
  })

  it('treats missing parents as roots', () => {
    const ordered = orderGroupsAsTree([
      { id: 'orphan', label: 'Orphan', parentId: 'missing' },
    ])
    assert.equal(ordered[0]?.depth, 0)
  })
})
