/**
 * Manifest `requires` must match the reviewed graph in module-install-packages.md.
 * Run: npx tsx scripts/verify-module-requires.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { ALL_MODULE_MANIFESTS } from '../src/modules/manifest-index.ts'

const doc = readFileSync('docs/project-context/docs/module-install-packages.md', 'utf8')
const start = doc.indexOf('<!-- requires-graph:start -->')
const end = doc.indexOf('<!-- requires-graph:end -->')
assert.ok(start >= 0 && end > start, 'requires-graph markers missing')
const block = doc.slice(start, end)
const fromDoc = new Map<string, string[]>()
for (const raw of block.split('\n')) {
  const line = raw.replace(/\r$/, '')
  const arrow = line.indexOf('\u2192')
  if (!line.startsWith('- ') || arrow < 0) continue
  const id = line.slice(2, arrow).trim()
  const deps = line
    .slice(arrow + 1)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  fromDoc.set(id, deps)
}

const fromManifest = new Map<string, string[]>()
for (const entry of ALL_MODULE_MANIFESTS) {
  if (entry.requires?.length) fromManifest.set(entry.id, [...entry.requires])
}

assert.deepEqual(
  [...fromManifest.keys()].sort(),
  [...fromDoc.keys()].sort(),
  'manifest requires ids drifted from the doc graph',
)
for (const [id, deps] of fromManifest) {
  assert.deepEqual(deps, fromDoc.get(id), `${id} requires drifted`)
}

const events = fromManifest.get('product:events') ?? []
assert.equal(events.includes('product:subscriptions'), false)
assert.equal(fromManifest.has('product:payments') && !(fromManifest.get('product:payments') ?? []).includes('product:forms'), true)

console.log(`verify-module-requires: pass (${fromManifest.size} edges)`)
