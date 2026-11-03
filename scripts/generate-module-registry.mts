/**
 * Reads `starforge.modules.json` (or `SF_MODULES`) + module manifests and writes
 * `src/generated/module-registry.ts` — only allowlisted optional packs get dynamic import()
 * loaders so unused product modules are not eager-imported (SF-95 / SF-141).
 *
 * Manifest source: `defineStarforgeModule` entries via `src/modules/manifest-index.ts`.
 *
 * Usage: npm run modules:generate
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { StarforgeModuleManifest } from '../src/core/modules/define-module.ts'
import { ALL_MODULE_MANIFESTS } from '../src/modules/manifest-index.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ALLOWLIST_PATH = path.join(ROOT, 'starforge.modules.json')
const OUT_PATH = path.join(ROOT, 'src/generated/module-registry.ts')

type AllowlistFile = {
  flavor?: string
  modules?: unknown
}

const FIXED_REQUIRED = ALL_MODULE_MANIFESTS.filter((e) => e.required).map((e) => e.id)

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

function isPlatformOrProduct(kind: StarforgeModuleManifest['kind']): boolean {
  return kind === 'platform' || kind === 'product'
}

function isParticleKind(kind: StarforgeModuleManifest['kind']): boolean {
  return kind === 'particle' || kind === 'particle-pack'
}

function catalogMetaLiteral(entry: StarforgeModuleManifest): string {
  const parts = [
    `id: ${jsonString(entry.id)}`,
    `kind: ${jsonString(entry.kind === 'particle-pack' ? 'particle' : entry.kind === 'hero' ? 'product' : entry.kind)}`,
    `label: ${jsonString(entry.label)}`,
    `description: ${jsonString(entry.description)}`,
    `required: ${entry.required === true}`,
    `defaultEnabled: ${entry.defaultEnabled !== false}`,
    `installed: true as const`,
  ]
  if (entry.featureFlag) parts.push(`featureFlag: ${jsonString(entry.featureFlag)}`)
  if (entry.navViews?.length) parts.push(`navViews: ${jsonString(entry.navViews)}`)
  return `{ ${parts.join(', ')} }`
}

function particleMetaLiteral(entry: StarforgeModuleManifest): string {
  const parts = [
    `id: ${jsonString(entry.id)}`,
    `name: ${jsonString(entry.label)}`,
    `description: ${jsonString(entry.description)}`,
    `required: ${entry.required === true}`,
    `defaultEnabled: ${entry.defaultEnabled !== false}`,
    `builtin: ${entry.builtin === true}`,
  ]
  if (entry.featureFlag) parts.push(`featureFlag: ${jsonString(entry.featureFlag)}`)
  if (entry.navViews?.length) parts.push(`navViews: ${jsonString(entry.navViews)}`)
  return `{ ${parts.join(', ')} }`
}

function atomMetaLiteral(entry: StarforgeModuleManifest): string {
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

  const known = new Map(ALL_MODULE_MANIFESTS.map((e) => [e.id, e]))
  const unknown = requested.filter((id) => !known.has(id))
  if (unknown.length) {
    console.warn(`[modules:generate] Ignoring unknown ids: ${unknown.join(', ')}`)
  }

  const dupes = ALL_MODULE_MANIFESTS.map((e) => e.id).filter(
    (id, i, arr) => arr.indexOf(id) !== i,
  )
  if (dupes.length) {
    throw new Error(`[modules:generate] Duplicate manifest ids: ${[...new Set(dupes)].join(', ')}`)
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
  const allowlistedEntries = ALL_MODULE_MANIFESTS.filter((e) => allowSet.has(e.id))

  const optionalParticles = allowlistedEntries.filter(
    (e) =>
      isParticleKind(e.kind) &&
      !e.builtin &&
      e.importPath &&
      e.exportName,
  )
  const optionalAtoms = allowlistedEntries.filter(
    (e) => e.kind === 'atom' && e.importPath && e.exportName,
  )
  const builtinParticles = allowlistedEntries.filter(
    (e) => isParticleKind(e.kind) && e.builtin,
  )
  const productPlatform = allowlistedEntries.filter((e) => isPlatformOrProduct(e.kind))

  const publicShellEntries: Array<{
    moduleId: string
    slot: string
    importPath: string
    exportName: string
  }> = []
  for (const entry of allowlistedEntries) {
    for (const shell of entry.publicShell ?? []) {
      if (!shell.importPath?.trim()) {
        console.warn(
          `[modules:generate] Skipping publicShell on ${entry.id} — missing importPath`,
        )
        continue
      }
      publicShellEntries.push({
        moduleId: entry.id,
        slot: shell.slot,
        importPath: shell.importPath.trim(),
        exportName: shell.exportName?.trim() || 'default',
      })
    }
  }

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

  const publicShellLoaders = publicShellEntries
    .map((e) => {
      const loadExpr =
        e.exportName === 'default'
          ? `async () => (await import(${jsonString(e.importPath)})).default`
          : `async () => (await import(${jsonString(e.importPath)})).${e.exportName}`
      return `  {
    moduleId: ${jsonString(e.moduleId)},
    slot: ${jsonString(e.slot)},
    load: ${loadExpr},
  }`
    })
    .join(',\n')

  const productPlatformMeta = productPlatform.map(catalogMetaLiteral).join(',\n  ')
  const particleMeta = [...builtinParticles, ...optionalParticles]
    .map(particleMetaLiteral)
    .join(',\n  ')
  const optionalParticleMeta = optionalParticles.map(particleMetaLiteral).join(',\n  ')
  const atomMeta = optionalAtoms.map(atomMetaLiteral).join(',\n  ')
  const builtinParticleIds = builtinParticles.map((e) => e.id)
  const productPlatformIds = productPlatform.map((e) => e.id)

  const body = `/**
 * AUTO-GENERATED by \`npm run modules:generate\` — do not edit.
 * Source: starforge.modules.json (or SF_MODULES) + src/modules/manifest-index.ts
 * Flavor: ${flavor}
 * Generated: ${new Date().toISOString()}
 */

import type { ComponentType, ReactNode } from 'react'

import type { StarforgeModule } from '@/core/modules/types'
import type { StarforgeAtomDefinition } from '@/core/page-settings/types'
import type { FeatureFlags } from '@/core/settings/defaults'
import type { ModuleCatalogItem } from '@/core/settings/module-toggles'

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

/**
 * Derived Site Settings → Modules rows for platform + product packs.
 * Replaces the hand-maintained PRODUCT_MODULE_CATALOG.
 */
export const ALLOWLISTED_PRODUCT_PLATFORM_META: ModuleCatalogItem[] = [
  ${productPlatformMeta || '// (none)'}
]

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
  builtin: boolean
  featureFlag?: keyof FeatureFlags
  navViews?: Array<{ key: string; label: string; href: string }>
}

/** Catalog rows for allowlisted particles (builtin + optional). */
export const ALLOWLISTED_PARTICLE_META: AllowlistedParticleMeta[] = [
  ${particleMeta || '// (none)'}
]

/** @deprecated Prefer ALLOWLISTED_PARTICLE_META filtered by !builtin — kept for older callers. */
export const ALLOWLISTED_OPTIONAL_PARTICLE_META: AllowlistedParticleMeta[] = [
  ${optionalParticleMeta || '// (none)'}
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

export type PublicShellSlot = 'head' | 'bodyStart' | 'bodyEnd'

export type PublicShellLoader = {
  moduleId: string
  slot: PublicShellSlot
  load: () => Promise<ComponentType<Record<string, never>> | ((...args: never[]) => ReactNode)>
}

/** Public layout shell contributions from allowlisted module manifests. */
export const publicShellLoaders: PublicShellLoader[] = [
${publicShellLoaders || '  // (none allowlisted)'}
]

export async function loadAllowlistedOptionalParticles(): Promise<StarforgeModule[]> {
  return Promise.all(optionalParticleLoaders.map((entry) => entry.load()))
}

export async function loadAllowlistedAtoms(): Promise<StarforgeAtomDefinition[]> {
  return Promise.all(optionalAtomLoaders.map((entry) => entry.load()))
}

export async function loadPublicShellSlot(
  slot: PublicShellSlot,
): Promise<Array<{ moduleId: string; Component: ComponentType<Record<string, never>> }>> {
  const matched = publicShellLoaders.filter((entry) => entry.slot === slot)
  const loaded = await Promise.all(
    matched.map(async (entry) => ({
      moduleId: entry.moduleId,
      Component: (await entry.load()) as ComponentType<Record<string, never>>,
    })),
  )
  return loaded
}
`

  await mkdir(path.dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, body, 'utf8')
  console.log(
    `[modules:generate] Wrote ${path.relative(ROOT, OUT_PATH)} (${allowlisted.length} ids, ${optionalParticles.length} optional particles, ${optionalAtoms.length} atoms, ${publicShellEntries.length} publicShell)`,
  )
}

main().catch((error) => {
  console.error('[modules:generate] Failed:', error)
  process.exitCode = 1
})
