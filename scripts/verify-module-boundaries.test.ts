/**
 * Proves the boundary checker rejects a new Maps → Events store import
 * that is not on the allowlist, including a type-only internal import.
 * Comments that mention an import are not edges.
 *
 * Run: npm run verify:module-boundaries
 */
import assert from 'node:assert/strict'
import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { after, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { auditModuleBoundaries } from './verify-module-boundaries'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PROBES = [
  'src/modules/maps/__boundary-probe__.ts',
  'src/modules/maps/__boundary-probe-type__.ts',
  'src/modules/maps/__boundary-probe-comment__.ts',
  'src/modules/events/__boundary-probe-maps-door__.ts',
  'src/modules/events/foo.ts',
  'src/hero/__boundary-probe-door__.ts',
]

function abs(rel: string): string {
  return path.join(ROOT, rel)
}

after(async () => {
  await Promise.all(PROBES.map((rel) => rm(abs(rel), { force: true })))
})

describe('verify-module-boundaries', () => {
  it('rejects an unauthorized Maps import of @/modules/events/store', async () => {
    const rel = PROBES[0]!
    await writeFile(
      abs(rel),
      "import { listEvents } from '@/modules/events/store'\nexport const boundaryProbe = listEvents\n",
    )
    try {
      const report = await auditModuleBoundaries()
      const hits = report.violations.filter((hit) => hit.from.endsWith('__boundary-probe__.ts'))
      assert.ok(hits.length >= 1, 'probe file should fail verification')
      assert.equal(hits[0]?.specifier, '@/modules/events/store')
      assert.ok(hits[0]?.reasons.includes('forbidden-layer'))
      assert.ok(hits[0]?.reasons.includes('private-internal'))
      assert.ok(hits[0]?.reasons.includes('undeclared'))
      assert.ok(hits[0]?.reasons.includes('cycle'))
      const others = report.violations.filter((hit) => !hit.from.includes('__boundary-probe'))
      for (const hit of others) {
        assert.deepEqual(
          hit.reasons,
          ['cycle'],
          `${hit.from} ${hit.specifier} should only pick up the temporary cycle`,
        )
      }
    } finally {
      await rm(abs(rel), { force: true })
    }
  })

  it('rejects a type-only import of another pack internal', async () => {
    const rel = PROBES[1]!
    await writeFile(
      abs(rel),
      "import type { EventRecord } from '@/modules/events/store'\nexport type BoundaryProbe = EventRecord\n",
    )
    try {
      const report = await auditModuleBoundaries()
      const hits = report.violations.filter((hit) => hit.from.endsWith('__boundary-probe-type__.ts'))
      assert.ok(hits.some((hit) => hit.importKind === 'type' && hit.specifier === '@/modules/events/store'))
      assert.ok(hits.some((hit) => hit.reasons.includes('private-internal')))
    } finally {
      await rm(abs(rel), { force: true })
    }
  })

  it('does not treat a commented import as an edge', async () => {
    const rel = PROBES[2]!
    await writeFile(
      abs(rel),
      "// import { listEvents } from '@/modules/events/store'\nexport const boundaryProbe = true\n",
    )
    try {
      const report = await auditModuleBoundaries()
      const hits = report.violations.filter((hit) => hit.from.endsWith('__boundary-probe-comment__.ts'))
      assert.deepEqual(hits, [])
    } finally {
      await rm(abs(rel), { force: true })
    }
  })

  it('treats the Maps widget barrel, api, and api.server as public entries', async () => {
    const rel = PROBES[3]!
    await writeFile(
      abs(rel),
      [
        "import { mapModule } from '@/modules/maps'",
        "import { MapView } from '@/modules/maps/api'",
        "import { registerEventCatalog } from '@/modules/maps/api.server'",
        "import { VenueLocationMap } from '@/modules/maps/VenueLocationMap'",
        'export const boundaryProbe = { mapModule, MapView, registerEventCatalog, VenueLocationMap }',
        '',
      ].join('\n'),
    )
    try {
      const report = await auditModuleBoundaries()
      const hits = report.violations.filter((hit) => hit.from.endsWith('__boundary-probe-maps-door__.ts'))
      const reasonsFor = (specifier: string) =>
        hits.find((hit) => hit.specifier === specifier)?.reasons
      assert.equal(reasonsFor('@/modules/maps'), undefined)
      assert.equal(reasonsFor('@/modules/maps/api'), undefined)
      assert.equal(reasonsFor('@/modules/maps/api.server'), undefined)
      assert.deepEqual(reasonsFor('@/modules/maps/VenueLocationMap'), ['private-internal'])
      assert.equal(report.staleAllowlist.length, 0)
      assert.equal(report.driftedAllowlist.length, 0)
    } finally {
      await rm(abs(rel), { force: true })
    }
  })

  it('allowlist is empty after stages 0–9', async () => {
    const raw = JSON.parse(await readFile(path.join(ROOT, 'scripts/module-boundary-allowlist.json'), 'utf8')) as {
      entries: Array<{ id: string; from: string; specifier: string }>
    }
    const ids = new Set(raw.entries.map((entry) => entry.id))
    assert.equal(raw.entries.length, 0, 'stages 0–9 must leave the boundary allowlist empty')
    for (const id of ['C1', 'C2', 'C3', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H10']) {
      assert.equal(ids.has(id), false, `${id} must not remain on the allowlist`)
    }
    const instrumentationRows = raw.entries.filter((entry) => entry.from === 'src/instrumentation.ts')
    assert.deepEqual(instrumentationRows, [], 'Stage 6 removed instrumentation pack imports')
    const mapsToEvents = raw.entries.filter(
      (entry) =>
        entry.from.startsWith('src/modules/maps/') && entry.specifier.includes('/events'),
    )
    assert.deepEqual(mapsToEvents, [])
    const formsToEvents = raw.entries.filter(
      (entry) =>
        entry.from.startsWith('src/modules/forms/') && entry.specifier.includes('/events'),
    )
    assert.deepEqual(formsToEvents, [])
    const paymentsToSubscriptions = raw.entries.filter(
      (entry) =>
        entry.from.startsWith('src/modules/payments/') &&
        entry.specifier.includes('/subscriptions'),
    )
    assert.deepEqual(paymentsToSubscriptions, [])
  })

  it('rejects src/modules/events/foo.ts importing @/hero and keeps hero on public doors', async () => {
    const moduleRel = 'src/modules/events/foo.ts'
    const heroRel = 'src/hero/__boundary-probe-door__.ts'
    await writeFile(
      abs(moduleRel),
      "import { hero } from '@/hero/default/manifest'\nexport const boundaryProbe = hero\n",
    )
    await writeFile(
      abs(heroRel),
      [
        "import { hero } from '@/hero/default/manifest'",
        "import { registerFormPreset } from '@/modules/forms/api'",
        "import { registerPaymentConsumerHook } from '@/modules/payments/api'",
        "import { listEvents } from '@/modules/events/store'",
        'export const boundaryProbe = { hero, registerFormPreset, registerPaymentConsumerHook, listEvents }',
        '',
      ].join('\n'),
    )
    try {
      const report = await auditModuleBoundaries()
      const moduleHits = report.violations.filter((hit) => hit.from === moduleRel)
      assert.ok(
        moduleHits.some(
          (hit) =>
            hit.specifier === '@/hero/default/manifest' && hit.reasons.includes('forbidden-layer'),
        ),
        'events must not import the hero manifest',
      )
      const heroHits = report.violations.filter((hit) => hit.from === heroRel)
      assert.equal(
        heroHits.find((hit) => hit.specifier === '@/hero/default/manifest'),
        undefined,
        'hero files may import other hero files',
      )
      assert.equal(heroHits.find((hit) => hit.specifier === '@/modules/forms/api'), undefined)
      assert.equal(heroHits.find((hit) => hit.specifier === '@/modules/payments/api'), undefined)
      assert.ok(
        heroHits.some(
          (hit) =>
            hit.specifier === '@/modules/events/store' && hit.reasons.includes('private-internal'),
        ),
      )
    } finally {
      await rm(abs(moduleRel), { force: true })
      await rm(abs(heroRel), { force: true })
    }
  })
})
