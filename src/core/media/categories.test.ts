import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  MEDIA_CATEGORY_MAX_DEPTH,
  buildCategoryTree,
  findCategoryInTree,
  flattenCategoryOptions,
  folderFromCategorySlug,
  legacyFolderSeedCategories,
  slugifyCategoryName,
} from './categories'

describe('media categories helpers', () => {
  it('slugifies folder names', () => {
    assert.equal(slugifyCategoryName('Event Flyers'), 'event-flyers')
    assert.equal(slugifyCategoryName('  Logos / Brand  '), 'logos-brand')
  })

  it('maps legacy folder seeds 1:1', () => {
    const seeds = legacyFolderSeedCategories()
    assert.ok(seeds.some((s) => s.slug === 'general' && s.depth === 0))
    assert.ok(seeds.some((s) => s.slug === 'forms'))
    assert.equal(folderFromCategorySlug('logos'), 'logos')
    assert.equal(folderFromCategorySlug('unknown-nested'), 'general')
  })

  it('builds a nested tree and flattens with depth', () => {
    const tree = buildCategoryTree([
      { id: '1', title: 'General', slug: 'general', parentId: null, depth: 0 },
      { id: '2', title: 'Events', slug: 'events', parentId: '1', depth: 1 },
      { id: '3', title: '2026', slug: '2026', parentId: '2', depth: 2 },
      { id: '4', title: 'Logos', slug: 'logos', parentId: null, depth: 0 },
    ])
    assert.equal(tree.length, 2)
    const general = findCategoryInTree(tree, '1')
    assert.ok(general)
    assert.equal(general.children[0]?.title, 'Events')
    assert.equal(general.children[0]?.children[0]?.slug, '2026')
    const flat = flattenCategoryOptions(tree)
    assert.equal(flat.find((f) => f.id === '3')?.depth, 2)
    assert.ok(MEDIA_CATEGORY_MAX_DEPTH >= 4)
  })
})
