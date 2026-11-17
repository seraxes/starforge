import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  barePathForSlug,
  internalRootHref,
  navItemCanBeRoot,
  normalizeSiteRootPointer,
} from './root-target'

describe('site root target', () => {
  it('keeps slug home at / until a root is set', () => {
    assert.equal(barePathForSlug('home', undefined), '/')
    assert.equal(barePathForSlug('about', undefined), '/about')
  })

  it('maps only the chosen page slug to /', () => {
    assert.equal(barePathForSlug('about', 'about'), '/')
    assert.equal(barePathForSlug('home', 'about'), '/home')
  })

  it('maps no page slug to / when a module owns the root', () => {
    assert.equal(barePathForSlug('home', null), '/home')
    assert.equal(barePathForSlug('events', null), '/events')
  })

  it('refuses admin and external targets', () => {
    assert.equal(navItemCanBeRoot({ linkType: 'page' }), true)
    assert.equal(navItemCanBeRoot({ linkType: 'module' }), true)
    assert.equal(navItemCanBeRoot({ linkType: 'admin' }), false)
    assert.equal(navItemCanBeRoot({ linkType: 'url', url: 'https://example.com' }), false)
    assert.equal(navItemCanBeRoot({ linkType: 'url', url: 'mailto:a@b.c' }), false)
    assert.equal(navItemCanBeRoot({ linkType: 'url', url: '/' }), false)
    assert.equal(navItemCanBeRoot({ linkType: 'url', url: '/events' }), true)
    assert.equal(internalRootHref('/events/'), '/events')
  })

  it('reads a menu and item id', () => {
    assert.deepEqual(normalizeSiteRootPointer({ menuId: ' main ', itemId: 'item-1' }), {
      menuId: 'main',
      itemId: 'item-1',
    })
    assert.equal(normalizeSiteRootPointer({ menuId: '', itemId: 'x' }), null)
    assert.equal(normalizeSiteRootPointer(null), null)
  })
})
