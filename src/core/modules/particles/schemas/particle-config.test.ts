import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { tagMatchesViewer } from '@/core/acl/nav-access'
import type { AccessViewer } from '@/core/acl/types'
import { accountNavMenuSeedItems } from '@/core/nav/account-menu-seed'

import { accountMenuParticleConfigSchema } from './account-menu'
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

  it('normalizes account menu avatar shape and size', () => {
    const parsed = accountMenuParticleConfigSchema.safeParse({
      avatarShape: 'hexagon',
      avatarSize: '48.2',
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.avatarShape, 'hexagon')
    assert.equal(parsed.data.avatarSize, 48)

    const fallback = accountMenuParticleConfigSchema.safeParse({
      avatarShape: 'triangle',
      avatarSize: 4,
    })
    assert.equal(fallback.success, true)
    if (!fallback.success) return
    assert.equal(fallback.data.avatarShape, 'circle')
    assert.equal(fallback.data.avatarSize, 20)
    assert.equal(fallback.data.menuId, 'account')
  })

  it('binds a blank account menu id to the Account navigation menu', () => {
    const kept = accountMenuParticleConfigSchema.safeParse({
      menuId: ' footer ',
      avatarShape: 'square',
    })
    assert.equal(kept.success, true)
    if (!kept.success) return
    assert.equal(kept.data.menuId, 'footer')
    assert.equal(kept.data.avatarShape, 'square')

    const primary = accountMenuParticleConfigSchema.safeParse({ menuId: 'primary' })
    assert.equal(primary.success, true)
    if (!primary.success) return
    assert.equal(primary.data.menuId, 'account')

    const blank = accountMenuParticleConfigSchema.safeParse({ menuId: '   ' })
    assert.equal(blank.success, true)
    if (!blank.success) return
    assert.equal(blank.data.menuId, 'account')
  })

  it('seeds account menu links for signed-out and signed-in viewers', () => {
    const items = accountNavMenuSeedItems()
    const byId = new Map(items.map((item) => [item.id, item]))
    assert.equal(byId.get('account-sign-in')?.accessTags[0], 'group:visitors')
    assert.equal(byId.get('account-home')?.label, 'Account')
    assert.equal(byId.get('account-home')?.accessTags[0], 'registered')
    assert.equal(byId.get('account-home')?.linkType, 'module')
    assert.equal(byId.get('account-security')?.url, '/account/security')

    const guest: AccessViewer = {
      userId: null,
      isRegistered: false,
      isAppAdmin: false,
      groupIds: [],
    }
    const member: AccessViewer = {
      userId: 'user-1',
      isRegistered: true,
      isAppAdmin: true,
      groupIds: [],
    }
    assert.equal(tagMatchesViewer('group:visitors', guest), true)
    assert.equal(tagMatchesViewer('guest', guest), true)
    assert.equal(tagMatchesViewer('registered', guest), false)
    assert.equal(tagMatchesViewer('group:visitors', member), false)
    assert.equal(tagMatchesViewer('registered', member), true)
  })
})
