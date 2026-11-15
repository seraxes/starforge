import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { ACTIVE_HERO } from '@/generated/module-registry'

import { hero } from './manifest'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')

describe('default hero', () => {
  it('adds no fields, no skin, and no boot', () => {
    assert.equal(hero.id, 'default')
    assert.equal(hero.profileFields, undefined)
    assert.equal(hero.boot, undefined)
    assert.equal(hero.skinId, undefined)
    assert.equal(ACTIVE_HERO.id, 'default')
    assert.equal(ACTIVE_HERO.label, 'Default')
    assert.equal(ACTIVE_HERO.skinId, null)
    assert.deepEqual([...ACTIVE_HERO.profileFields], [])

    const server = readFileSync(
      path.join(ROOT, 'src/generated/module-registry.server.ts'),
      'utf8',
    )
    assert.match(server, /export const heroBootLoader: ModuleBootLoader \| null = null/)
    const instrumentation = readFileSync(path.join(ROOT, 'src/instrumentation.ts'), 'utf8')
    assert.match(instrumentation, /runHeroBoot\(\)/)
    assert.equal(instrumentation.includes('@/hero'), false)
  })
})