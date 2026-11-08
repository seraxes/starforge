import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ageYears,
  normalizeHandle,
  normalizeHttpUrl,
  normalizeProfileLinks,
  roundCoordinate,
  slugifyHandleBase,
  validateHandle,
} from './fields'
import {
  effectiveVisibility,
  fallbackPersona,
  profileCompleteness,
  projectPersona,
  scopeAllows,
} from './privacy'
import type { ProfileRecord, ProfilesModuleSettings } from './types'
import { DEFAULT_PROFILES_MODULE_SETTINGS } from './types'

describe('product:profiles fields', () => {
  it('validates handles', () => {
    assert.equal(validateHandle('sera').ok, true)
    assert.equal(validateHandle('ab').ok, false)
    assert.equal(validateHandle('Admin').ok, false)
    assert.equal(validateHandle('ser__a').ok, false)
    assert.equal(normalizeHandle('SeRa'), 'sera')
  })

  it('slugifies a display-name seed', () => {
    assert.equal(slugifyHandleBase('Spider Catz'), 'spider-catz')
  })

  it('rejects non-http URLs', () => {
    assert.equal(normalizeHttpUrl('javascript:alert(1)'), '')
    assert.ok(normalizeHttpUrl('example.com').startsWith('https://'))
  })

  it('normalizes social links', () => {
    const links = normalizeProfileLinks([
      { label: 'IG', url: 'https://instagram.com/x' },
      { label: 'bad', url: 'javascript:x' },
    ])
    assert.equal(links.length, 1)
    assert.equal(links[0]?.label, 'IG')
  })

  it('computes age and rounds coords', () => {
    assert.equal(ageYears('2000-01-01', new Date('2020-01-02T00:00:00Z')), 20)
    assert.equal(roundCoordinate(47.497912), 47.5)
  })
})

describe('product:profiles privacy', () => {
  const settings: ProfilesModuleSettings = {
    ...DEFAULT_PROFILES_MODULE_SETTINGS,
    disabledFields: [],
    requiredFields: [],
    defaultVisibility: {},
  }

  const base: ProfileRecord = {
    userId: 'u1',
    handle: 'sera',
    handleChangedAt: null,
    displayName: 'Sera',
    headline: 'Hello',
    bio: 'Bio text',
    avatarMediaId: 'm1',
    coverMediaId: 'm2',
    avatarFrame: { x: 50, y: 40, zoom: 1.2 },
    coverFrame: { x: 50, y: 50, zoom: 1 },
    birthDate: '1990-06-15',
    gender: 'female',
    country: 'HU',
    city: 'Budapest',
    latitude: 47.4979,
    longitude: 19.0402,
    website: 'https://example.com',
    phone: '+361234',
    links: [{ label: 'Site', url: 'https://example.com' }],
    locale: 'hu',
    timezone: 'Europe/Budapest',
    visibility: {
      bio: 'public',
      birthDate: 'public',
      phone: 'private',
      city: 'registered',
      location: 'public',
    },
    extensions: {},
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('maps visibility scopes to relations', () => {
    assert.equal(scopeAllows('public', 'anonymous'), true)
    assert.equal(scopeAllows('registered', 'anonymous'), false)
    assert.equal(scopeAllows('friends', 'registered'), false)
    assert.equal(scopeAllows('private', 'self'), true)
  })

  it('projects a Persona for anonymous viewers', () => {
    const persona = projectPersona(base, 'anonymous', settings)
    assert.equal(persona.bio, 'Bio text')
    assert.equal(persona.phone, null)
    assert.equal(persona.city, null)
    assert.equal(persona.location?.lat, 47.5)
    assert.equal(persona.href, '/u/sera')
    assert.ok((persona.ageYears ?? 0) >= 30)
  })

  it('shows private fields to self', () => {
    const persona = projectPersona(base, 'self', settings)
    assert.equal(persona.phone, '+361234')
    assert.equal(persona.city, 'Budapest')
    assert.equal(persona.location?.lat, 47.4979)
    assert.equal(persona.isSelf, true)
  })

  it('honors site default visibility', () => {
    assert.equal(
      effectiveVisibility('website', {}, { defaultVisibility: { website: 'private' } }),
      'private',
    )
  })

  it('builds a fallback Persona', () => {
    const p = fallbackPersona({ userId: 'x', name: 'Anon' })
    assert.equal(p.handle, '')
    assert.equal(p.displayName, 'Anon')
    assert.equal(p.href, null)
  })

  it('scores completeness', () => {
    assert.equal(profileCompleteness(base), 100)
    assert.equal(
      profileCompleteness({
        ...base,
        headline: '',
        bio: '',
        coverMediaId: '',
        birthDate: '',
        country: '',
        city: '',
        website: '',
        links: [],
        avatarMediaId: '',
      }),
      0,
    )
  })
})
