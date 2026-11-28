import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))

function loadKeys(file: string): string[] {
  const raw = JSON.parse(readFileSync(join(dir, 'messages', file), 'utf8')) as Record<
    string,
    unknown
  >
  return Object.keys(raw).sort()
}

describe('product:maps message packs', () => {
  it('keeps the same keys in en.json and hu.json', () => {
    const en = loadKeys('en.json')
    const hu = loadKeys('hu.json')
    assert.deepEqual(
      hu,
      en,
      `Maps message key mismatch.\nOnly in en: ${en.filter((k) => !hu.includes(k)).join(', ') || '(none)'}\nOnly in hu: ${hu.filter((k) => !en.includes(k)).join(', ') || '(none)'}`,
    )
  })

  it('fails when a key exists in only one locale file', () => {
    const en = new Set(loadKeys('en.json'))
    const hu = new Set(loadKeys('hu.json'))
    for (const key of en) {
      assert.ok(hu.has(key), `hu.json is missing key: ${key}`)
    }
    for (const key of hu) {
      assert.ok(en.has(key), `en.json is missing key: ${key}`)
    }
  })
})

