import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSkinRootCss } from './css-vars'
import {
  getDefaultSkin,
  getDefaultSkinId,
  getSkin,
  isRegisteredSkinId,
  listSkins,
} from './registry'
import { isOutlineOwnedBySkin, listSkinOutlineSeeds } from './outline-meta'
import {
  STARFORGE_PASTEL_DEFAULT_OUTLINE_ID,
  STARFORGE_PASTEL_SKIN_ID,
} from './skins/starforge-pastel'
import { starforgePastelTokens } from './skins/starforge-pastel/tokens'

describe('skin registry', () => {
  it('ships starforge-pastel as the default skin', () => {
    assert.equal(getDefaultSkinId(), STARFORGE_PASTEL_SKIN_ID)
    assert.equal(getDefaultSkin().id, STARFORGE_PASTEL_SKIN_ID)
    assert.ok(isRegisteredSkinId(STARFORGE_PASTEL_SKIN_ID))
    assert.equal(getSkin(STARFORGE_PASTEL_SKIN_ID)?.label, 'Starforge Pastel')
    assert.ok(listSkins().some((s) => s.id === STARFORGE_PASTEL_SKIN_ID))
  })

  it('ships Gantry-like outline seeds on starforge-pastel', () => {
    const skin = getSkin(STARFORGE_PASTEL_SKIN_ID)
    assert.ok(skin)
    const seeds = listSkinOutlineSeeds(skin!)
    assert.equal(seeds.length, 1)
    assert.equal(seeds[0]?.id, STARFORGE_PASTEL_DEFAULT_OUTLINE_ID)
    assert.equal(skin!.preferredDefaultOutlineId, STARFORGE_PASTEL_DEFAULT_OUTLINE_ID)
    assert.ok(isOutlineOwnedBySkin(STARFORGE_PASTEL_SKIN_ID, STARFORGE_PASTEL_DEFAULT_OUTLINE_ID))
    assert.equal(seeds[0]?.document.version, 3)
    assert.ok(Array.isArray(seeds[0]?.document.sections))
  })

  it('builds :root CSS vars from tokens', () => {
    const css = buildSkinRootCss(starforgePastelTokens)
    assert.match(css, /:root\s*\{/)
    assert.match(css, /--sf-primary:\s*#f2a66a;/)
    assert.match(css, /--sf-paper:\s*#f5f8fc;/)
  })
})
