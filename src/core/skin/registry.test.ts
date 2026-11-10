import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildSkinRootCss } from './css-vars'
import { serializeOutlineSeed, serializeSkinManifest } from './pack-io'
import { unzipSkinPack, zipSkinPack } from './pack-zip'
import {
  getDefaultSkin,
  getDefaultSkinId,
  getSkin,
  getSkinPack,
  invalidateSkinRegistry,
  isRegisteredSkinId,
  listSkins,
  STARFORGE_PASTEL_DEFAULT_OUTLINE_ID,
  STARFORGE_PASTEL_OFFLINE_OUTLINE_ID,
  STARFORGE_PASTEL_SKIN_ID,
} from './registry'
import { isOutlineOwnedBySkin, listSkinOutlineSeeds } from './outline-meta'
import { starforgePastelTokens } from './skins/starforge-pastel/tokens'

describe('skin registry', () => {
  it('ships starforge-pastel as the default skin from YAML pack', () => {
    invalidateSkinRegistry()
    assert.equal(getDefaultSkinId(), STARFORGE_PASTEL_SKIN_ID)
    assert.equal(getDefaultSkin().id, STARFORGE_PASTEL_SKIN_ID)
    assert.ok(isRegisteredSkinId(STARFORGE_PASTEL_SKIN_ID))
    assert.equal(getSkin(STARFORGE_PASTEL_SKIN_ID)?.label, 'Starforge Pastel')
    const skins = listSkins()
    assert.ok(skins.some((s) => s.id === STARFORGE_PASTEL_SKIN_ID))
    assert.equal(skins[0]?.id, STARFORGE_PASTEL_SKIN_ID, 'default system skin listed first')
    const pack = getSkinPack(STARFORGE_PASTEL_SKIN_ID)
    assert.ok(pack)
    assert.equal(pack!.source, 'bundled')
  })

  it('ships Gantry-like outline seeds on starforge-pastel', () => {
    invalidateSkinRegistry()
    const skin = getSkin(STARFORGE_PASTEL_SKIN_ID)
    assert.ok(skin)
    const seeds = listSkinOutlineSeeds(skin!)
    assert.equal(seeds.length, 2)
    assert.ok(seeds.some((s) => s.id === STARFORGE_PASTEL_DEFAULT_OUTLINE_ID))
    assert.ok(seeds.some((s) => s.id === STARFORGE_PASTEL_OFFLINE_OUTLINE_ID))
    assert.equal(skin!.preferredDefaultOutlineId, STARFORGE_PASTEL_DEFAULT_OUTLINE_ID)
    assert.ok(isOutlineOwnedBySkin(STARFORGE_PASTEL_SKIN_ID, STARFORGE_PASTEL_DEFAULT_OUTLINE_ID))
    const base = seeds.find((s) => s.id === STARFORGE_PASTEL_DEFAULT_OUTLINE_ID)
    assert.equal(base?.document.version, 3)
    assert.ok(Array.isArray(base?.document.sections))
  })

  it('builds body.sf-skin-* CSS vars from tokens', () => {
    const css = buildSkinRootCss(STARFORGE_PASTEL_SKIN_ID, starforgePastelTokens)
    assert.match(css, /body\.sf-skin-starforge-pastel\s*\{/)
    assert.match(css, /--sf-primary:\s*#f2a66a;/)
    assert.match(css, /--sf-paper:\s*#f5f8fc;/)
  })

  it('round-trips pastel pack through zip', async () => {
    invalidateSkinRegistry()
    const pack = getSkinPack(STARFORGE_PASTEL_SKIN_ID)
    assert.ok(pack)
    const zip = zipSkinPack(pack!)
    assert.ok(zip.byteLength > 100)
    const input = await unzipSkinPack(zip)
    assert.equal(input.id, STARFORGE_PASTEL_SKIN_ID)
    assert.equal(input.label, 'Starforge Pastel')
    assert.ok(input.outlines.length >= 2)
    assert.match(serializeSkinManifest(input), /id: starforge-pastel/)
    assert.match(
      serializeOutlineSeed(input.outlines[0]!),
      /version: 3/,
    )
  })
})
