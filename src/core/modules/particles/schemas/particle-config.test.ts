import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { copyrightParticleConfigSchema } from './copyright'
import { customParticleConfigSchema } from './custom'
import { localeSwitcherParticleConfigSchema } from './locale-switcher'
import { logoParticleConfigSchema } from './logo'
import { menuParticleConfigSchema } from './menu'
import { socialParticleConfigSchema } from './social'
import { spacerParticleConfigSchema } from './spacer'

describe('particle config schemas (M1)', () => {
  it('normalizes logo mode and color', () => {
    const parsed = logoParticleConfigSchema.safeParse({
      mode: 'text',
      text: ' Brand ',
      color: '#2a3340',
      fontWeight: '700',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.mode, 'text')
    assert.equal(parsed.data.text, 'Brand')
    assert.equal(parsed.data.color, '#2a3340')
    assert.equal(parsed.data.fontWeight, 700)
  })

  it('rejects invalid logo color', () => {
    const parsed = logoParticleConfigSchema.safeParse({
      mode: 'text',
      color: 'expression(alert(1))',
    })
    assert.equal(parsed.success, false)
  })

  it('maps menu primary to empty menuId', () => {
    const parsed = menuParticleConfigSchema.safeParse({
      menuId: 'primary',
      ariaLabel: '  Main  ',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.menuId, '')
    assert.equal(parsed.data.ariaLabel, 'Main')
  })

  it('normalizes copyright yearMode', () => {
    const parsed = copyrightParticleConfigSchema.safeParse({
      text: ' Rights ',
      yearMode: 'manual',
      year: 2024.7,
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.yearMode, 'manual')
    assert.equal(parsed.data.year, 2025)
  })

  it('normalizes spacer height and optional width', () => {
    const parsed = spacerParticleConfigSchema.safeParse({
      height: '48.2',
      width: '',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.height, 48)
    assert.equal(parsed.data.width, undefined)

    const withWidth = spacerParticleConfigSchema.safeParse({ height: 16, width: 120 })
    assert.equal(withWidth.success, true)
    if (!withWidth.success) return
    assert.equal(withWidth.data.height, 16)
    assert.equal(withWidth.data.width, 120)
  })

  it('filters social items', () => {
    const parsed = socialParticleConfigSchema.safeParse({
      items: [{ platform: 'X', url: 'https://x.com/' }, { platform: '', url: '' }],
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.ok(parsed.data.items)
    assert.equal(parsed.data.items.length, 1)
    assert.equal(parsed.data.items[0]?.platform, 'X')
  })

  it('trims custom particle fields', () => {
    const parsed = customParticleConfigSchema.safeParse({
      title: '  Box  ',
      html: '<p>Hi</p>',
      css: '',
      js: '',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.title, 'Box')
    assert.equal(parsed.data.html, '<p>Hi</p>')
  })

  it('normalizes locale switcher display', () => {
    const parsed = localeSwitcherParticleConfigSchema.safeParse({
      ariaLabel: '  Language  ',
      display: 'codes',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.ariaLabel, 'Language')
    assert.equal(parsed.data.display, 'codes')
  })
})
