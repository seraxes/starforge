/**
 * Reads `starforge.modules.json` (or `SF_MODULES`) + installable manifest and writes
 * `src/generated/module-registry.ts` — only allowlisted optional packs get dynamic import()
 * loaders so unused product modules are not eager-imported (SF-95 / P1).
 *
 * Usage: npm run modules:generate
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  INSTALLABLE_MANIFEST,
  type InstallableEntry,
} from '../src/modules/installable-manifest.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ALLOWLIST_PATH = path.join(ROOT, 'starforge.modules.json')
const OUT_PATH = path.join(ROOT, 'src/generated/module-registry.ts')

type AllowlistFile = {
  flavor?: string
  modules?: unknown
}

const FIXED_REQUIRED = INSTALLABLE_MANIFEST.filter((e) => e.required).map((e) => e.id)

function parseSfModulesEnv(raw: string | undefined): string[] | null {
  if (raw == null || !raw.trim()) return null
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const row of raw) {
    if (typeof row === 'string' && row.trim()) out.push(row.trim())
  }
  return out
}

function uniqSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
}

function jsonString(value: unknown): string {
  return JSON.stringify(value)
}

function particleMetaLiteral(entry: InstallableEntry): string {
  const parts = [
    `id: ${jsonString(entry.id)}`,
    `name: ${jsonString(entry.label)}`,
    `description: ${jsonString(entry.description)}`,
    `required: ${entry.required === true}`,
    `defaultEnabled: ${entry.defaultEnabled !== false}`,
  ]
  if (entry.featureFlag) parts.push(`featureFlag: ${jsonString(entry.featureFlag)}`)
  if (entry.navViews?.length) parts.push(`navViews: ${jsonString(entry.navViews)}`)
  return `{ ${parts.join(', ')} }`
}

function atomMetaLiteral(entry: InstallableEntry): string {
  const type = entry.id.startsWith('atom:') ? entry.id.slice('atom:'.length) : entry.id
  return `{ type: ${jsonString(type)}, toggleId: ${jsonString(entry.id)}, label: ${jsonString(entry.label)}, description: ${jsonString(entry.description)}, defaultEnabled: ${entry.defaultEnabled !== false} }`
}

async function main(): Promise<void> {
  const envList = parseSfModulesEnv(process.env.SF_MODULES)
  let flavor = 'core'
  let requested: string[]

  if (envList) {
    requested = envList
    console.log(`[modules:generate] Using SF_MODULES (${requested.length} ids)`)
  } else {
    const raw = await readFile(ALLOWLIST_PATH, 'utf8')
    const parsed = JSON.parse(raw) as AllowlistFile
    flavor = typeof parsed.flavor === 'string' && parsed.flavor.trim() ? parsed.flavor.trim() : 'core'
    requested = asIdList(parsed.modules)
    console.log(`[modules:generate] Using ${path.relative(ROOT, ALLOWLIST_PATH)} flavor=${flavor}`)
  }

  const known = new Map(INSTALLABLE_MANIFEST.map((e) => [e.id, e]))
  const unknown = requested.filter((id) => !known.has(id))
  if (unknown.length) {
    console.warn(`[modules:generate] Ignoring unknown ids: ${unknown.join(', ')}`)
  }

  let allowlisted = uniqSorted([
    ...FIXED_REQUIRED,
    ...requested.filter((id) => known.has(id)),
  ])

  // Drop optional entries whose requires[] are not allowlisted.
  allowlisted = allowlisted.filter((id) => {
    const entry = known.get(id)
    if (!entry?.requires?.length) return true
    const missing = entry.requires.filter((req) => !allowlisted.includes(req))
    if (missing.length) {
      console.warn(
        `[modules:generate] Dropping ${id} — missing requires: ${missing.join(', ')}`,
      )
      return false
    }
    return true
  })

  // Re-add fixed required after filter.
  allowlisted = uniqSorted([...FIXED_REQUIRED, ...allowlisted])

  const allowSet = new Set(allowlisted)
  const optionalParticles = INSTALLABLE_MANIFEST.filter(
    (e) =>
      e.kind === 'particle' &&
      !e.builtin &&
      e.importPath &&
      e.exportName &&
      allowSet.has(e.id),
  )
  const optionalAtoms = INSTALLABLE_MANIFEST.filter(
    (e) => e.kind === 'atom' && e.importPath && e.exportName && allowSet.has(e.id),
  )
  const builtinParticleIds = INSTALLABLE_MANIFEST.filter(
    (e) => e.kind === 'particle' && e.builtin && allowSet.has(e.id),
  ).map((e) => e.id)
  const productPlatformIds = INSTALLABLE_MANIFEST.filter(
    (e) => (e.kind === 'platform' || e.kind === 'product') && allowSet.has(e.id),
  ).map((e) => e.id)

  const particleLoaders = optionalParticles
    .map((e) => {
      return `  {
    id: ${jsonString(e.id)},
    load: async () => (await import(${jsonString(e.importPath!)})).${e.exportName!},
  }`
    })
    .join(',\n')

  const atomLoaders = optionalAtoms
    .map((e) => {
      const type = e.id.startsWith('atom:') ? e.id.slice('atom:'.length) : e.id
      return `  {
    type: ${jsonString(type)},
    toggleId: ${jsonString(e.id)},
    load: async () => (await import(${jsonString(e.importPath!)})).${e.exportName!},
  }`
    })
    .join(',\n')

  const particleMeta = optionalParticles.map(particleMetaLiteral).join(',\n  ')
  const atomMeta = optionalAtoms.map(atomMetaLiteral).join(',\n  ')

  const body = `/**
 * AUTO-GENERATED by \`npm run modules:generate\` — do not edit.
 * Source: starforge.modules.json (or SF_MODULES) + src/modules/installable-manifest.ts
 * Flavor: ${flavor}
 * Generated: ${new Date().toISOString()}
 */

import type { StarforgeModule } from '@/core/modules/types'
import type { StarforgeAtomDefinition } from '@/core/page-settings/types'

export const MODULE_ALLOWLIST_FLAVOR = ${jsonString(flavor)} as const

/** Fixed required ids — always installed even if omitted from the allowlist file. */
export const FIXED_REQUIRED_MODULE_IDS = ${jsonString(FIXED_REQUIRED)} as const

/** Allowlisted module ids for this install/build (platform + product + particles + atoms). */
export const ALLOWLISTED_MODULE_IDS = ${jsonString(allowlisted)} as const

export type AllowlistedModuleId = (typeof ALLOWLISTED_MODULE_IDS)[number]

export const ALLOWLISTED_MODULE_ID_SET: ReadonlySet<string> = new Set(ALLOWLISTED_MODULE_IDS)

export function isModuleAllowlisted(id: string): boolean {
  const key = id.trim()
  if (!key) return false
  if ((FIXED_REQUIRED_MODULE_IDS as readonly string[]).includes(key)) return true
  return ALLOWLISTED_MODULE_ID_SET.has(key)
}

/** Builtin core particle ids included in this build (static register from particles/). */
export const ALLOWLISTED_BUILTIN_PARTICLE_IDS: readonly string[] = ${jsonString(builtinParticleIds)}

/** Platform + product catalog ids installed in this build. */
export const ALLOWLISTED_PRODUCT_PLATFORM_IDS: readonly string[] = ${jsonString(productPlatformIds)}

export type OptionalParticleLoader = {
  id: string
  load: () => Promise<StarforgeModule>
}

/**
 * Dynamic import boundaries for optional / extension particles.
 * Packs absent from the allowlist are omitted here — not eager-imported.
 */
export const optionalParticleLoaders: OptionalParticleLoader[] = [
${particleLoaders || '  // (none allowlisted)'}
]

export type AllowlistedParticleMeta = {
  id: string
  name: string
  description: string
  required: boolean
  defaultEnabled: boolean
  featureFlag?: 'registration' | 'richEditor' | 'posts' | 'modules' | 'draftPreview'
  navViews?: Array<{ key: string; label: string; href: string }>
}

/** Catalog rows for allowlisted optional particles (Site Settings → Modules). */
export const ALLOWLISTED_OPTIONAL_PARTICLE_META: AllowlistedParticleMeta[] = [
  ${particleMeta || '// (none)'}
]

export type OptionalAtomLoader = {
  type: string
  toggleId: string
  load: () => Promise<StarforgeAtomDefinition>
}

export const optionalAtomLoaders: OptionalAtomLoader[] = [
${atomLoaders || '  // (none allowlisted)'}
]

export type AllowlistedAtomMeta = {
  type: string
  toggleId: string
  label: string
  description: string
  defaultEnabled: boolean
}

export const ALLOWLISTED_ATOM_META: AllowlistedAtomMeta[] = [
  ${atomMeta || '// (none)'}
]

export async function loadAllowlistedOptionalParticles(): Promise<StarforgeModule[]> {
  return Promise.all(optionalParticleLoaders.map((entry) => entry.load()))
}

export async function loadAllowlistedAtoms(): Promise<StarforgeAtomDefinition[]> {
  return Promise.all(optionalAtomLoaders.map((entry) => entry.load()))
}
`

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, body, 'utf8')
  console.log(
    `[modules:generate] Wrote ${path.relative(ROOT, OUT_PATH)} (${allowlisted.length} ids, ${optionalParticles.length} optional particles, ${optionalAtoms.length} atoms)`,
  )
}

main().catch((error) => {
  console.error('[modules:generate] Failed:', error)
  process.exitCode = 1
})
