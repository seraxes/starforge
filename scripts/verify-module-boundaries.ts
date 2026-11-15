/**
 * Stage 0 — module boundary checker.
 *
 * Walks `src/**\/*.{ts,tsx}` for module imports (static, dynamic `import()`, and
 * type-only). Alias form is `@/modules/<folder>` and `@/hero`. A relative
 * specifier is included when it resolves into `src/modules/<folder>` or
 * `src/hero` (so `src/instrumentation.ts` → `./modules/events/...` counts).
 * Maps each folder to a manifest
 * id the same way `scripts/generate-module-registry.mts` does, then fails when
 * a new edge is a cycle, a forbidden layer dependency, an undeclared `requires`
 * or `optionalRequires` edge, or an import of another pack's private files.
 *
 * A cycle means the target pack can already reach the source pack, including
 * through a longer path. Declared public imports that only fail because they
 * sit in that component are allowlisted as `current` until the cycle is cut.
 *
 * Known violations live in `scripts/module-boundary-allowlist.json`. A row
 * matches one source file and one specifier, so a new file is not covered.
 *
 * Public entries (ARCHITECTURE_REMEDIATION_PLAN.md §1):
 * - `@/modules/<folder>/api` and `@/modules/<folder>/api.server`
 * - `@/modules/form` and `@/modules/maps` (documented client barrels).
 * - Admin, public, and API pages named by manifest `admin.routes`, `publicRoutes`,
 *   and `apiRoutes`, and only when the importer is under `src/app` (generated shim).
 *
 * `product:forms` and the `form` particle are one family: the particle may
 * import the forms engine. Every other pack must use `@/modules/forms/api`
 * and `@/modules/form`.
 *
 * Hero files may import other `@/hero` files. They may import a pack only
 * through `@/modules/<id>/api` and `api.server`. `src/modules` and `src/core`
 * may not import `@/hero`.
 *
 * Type-only imports of a public entry are allowed. Type-only imports of another
 * pack's internal files are violations. Comments are not imports.
 *
 * Import resolution limits (not followed):
 * - Dynamic `import()` whose argument is not a string literal.
 * - Re-exports: the checker does not open the target file.
 * - Symbol-level types: `import type` is classified by the module path only.
 * - `@starforge/module-*` package names (consent and notice-bar packages).
 * - `src/generated/**` (codegen loaders; Core is supposed to import those files).
 *
 * Usage:
 *   npm run verify:module-boundaries
 *   tsx scripts/verify-module-boundaries.ts --suggest
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

import type {
  StarforgeModuleLayer,
  StarforgeModuleManifest,
} from '../src/core/modules/define-module'
import { ALL_MODULE_MANIFESTS } from '../src/modules/manifest-index'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const ALLOWLIST_PATH = path.join(ROOT, 'scripts/module-boundary-allowlist.json')
/** Documented client barrels: the form particle and the Maps widget barrel. */
const CLIENT_BARRELS = new Set(['form', 'maps'])

const FORM_PARTICLE_ID = 'form'
const FORMS_ENGINE_ID = 'product:forms'

/**
 * Pack layer comes from the manifest `layer` field.
 * Manifest `kind` is not the layer: site packs are also `kind: 'product'`.
 * Core platform, builtin particle, and atom rows omit `layer`.
 */
type ModuleLayer = StarforgeModuleLayer
type SourceKind = 'core' | 'app' | 'module' | 'hero' | 'host'
type ImportKind = 'static' | 'dynamic' | 'type'
type Reason = 'cycle' | 'forbidden-layer' | 'private-internal' | 'undeclared'

type AllowEntry = {
  id: string
  from: string
  specifier: string
  reasons: Reason[]
  note?: string
}

type AllowlistFile = {
  $comment?: string
  entries: AllowEntry[]
}

type Pack = {
  folder: string
  moduleId: string
  layer: ModuleLayer
  /** Direct `requires` plus `optionalRequires` when a manifest declares it. */
  requires: Set<string>
}

type SourceInfo = {
  kind: SourceKind
  moduleId: string
  layer: string
  requires: Set<string>
}

export type BoundaryHit = {
  from: string
  line: number
  specifier: string
  importKind: ImportKind
  fromKind: SourceKind
  fromModule: string
  fromLayer: string
  toModule: string
  toLayer: string
  reasons: Reason[]
  detail: string
}

export type BoundaryReport = {
  filesChecked: number
  crossModuleImports: number
  legal: number
  allowlisted: number
  violations: BoundaryHit[]
  staleAllowlist: AllowEntry[]
  driftedAllowlist: Array<{ entry: AllowEntry; found: Reason[] }>
}

const REASON_ORDER: Reason[] = ['cycle', 'forbidden-layer', 'private-internal', 'undeclared']

function toPosix(rel: string): string {
  return rel.replace(/\\/g, '/')
}

function normalizeSpecifier(spec: string): string {
  const noQuery = spec.split('?')[0] ?? spec
  return noQuery.replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, '')
}

function parseModuleSpecifier(spec: string): { folder: string; rest: string } | null {
  const match = /^@\/modules\/([^/]+)(?:\/(.*))?$/.exec(normalizeSpecifier(spec))
  if (!match?.[1]) return null
  return { folder: match[1], rest: match[2] ?? '' }
}

function isHeroSpecifier(spec: string): boolean {
  const norm = normalizeSpecifier(spec)
  return norm === '@/hero' || norm.startsWith('@/hero/')
}

/**
 * Alias specifiers pass through. Relative specifiers count only when the
 * resolved file sits in `src/modules/<folder>` or `src/hero`.
 */
function aliasForSpecifier(fromRel: string, spec: string, folders: ReadonlySet<string>): string | null {
  if (spec.startsWith('@/modules/') || isHeroSpecifier(spec)) return spec
  if (!spec.startsWith('.')) return null
  const abs = path.resolve(ROOT, path.dirname(fromRel), spec)
  const rel = toPosix(path.relative(ROOT, abs)).replace(/\.(tsx|ts|jsx|js|mjs|cjs)$/, '')
  if (rel === 'src/hero' || rel.startsWith('src/hero/')) return `@/${rel.slice('src/'.length)}`
  if (!rel.startsWith('src/modules/')) return null
  const rest = rel.slice('src/modules/'.length)
  const folder = rest.split('/')[0] ?? ''
  if (!folders.has(folder)) return null
  return `@/modules/${rest}`
}

/** The catalog index is allowed to import pack manifest modules and nothing else. */
function isCatalogManifestImport(fromRel: string, resolved: string): boolean {
  if (fromRel !== 'src/modules/manifest-index.ts') return false
  const rest = resolved.replace(/^@\/modules\//, '')
  return rest.endsWith('/manifest') || rest.endsWith('-manifest')
}

/**
 * Same folder resolution as `resolveModuleFolder` in
 * `scripts/generate-module-registry.mts`.
 */
function resolveModuleFolder(
  entry: StarforgeModuleManifest,
  folderNames: string[],
): string | null {
  const id = entry.id
  if (folderNames.includes(id)) return id
  for (const prefix of ['product:', 'platform:', 'atom:', 'hero:'] as const) {
    if (id.startsWith(prefix)) {
      const rest = id.slice(prefix.length)
      if (folderNames.includes(rest)) return rest
    }
  }
  const importPath = entry.importPath?.trim() ?? ''
  const fromImport = importPath.match(/@\/modules\/([^/]+)/)
  if (fromImport?.[1] && folderNames.includes(fromImport[1])) return fromImport[1]
  for (const shell of entry.publicShell ?? []) {
    const match = shell.importPath?.match(/@\/modules\/([^/]+)/)
    if (match?.[1] && folderNames.includes(match[1])) return match[1]
  }
  for (const widget of entry.admin?.dashboard ?? []) {
    const match = widget.widgetImportPath?.match(/@\/modules\/([^/]+)/)
    if (match?.[1] && folderNames.includes(match[1])) return match[1]
  }
  return null
}

/** Hard `requires` plus `optionalRequires`. Optional edges are declared, not installed. */
function declaredRequires(entry: StarforgeModuleManifest): Set<string> {
  return new Set([...(entry.requires ?? []), ...(entry.optionalRequires ?? [])])
}

function buildPacks(folderNames: string[]): Map<string, Pack> {
  const byFolder = new Map<string, StarforgeModuleManifest[]>()
  for (const entry of ALL_MODULE_MANIFESTS) {
    const folder = resolveModuleFolder(entry, folderNames)
    if (!folder) continue
    const list = byFolder.get(folder) ?? []
    list.push(entry)
    byFolder.set(folder, list)
  }

  const packs = new Map<string, Pack>()
  for (const folder of folderNames) {
    const matches = byFolder.get(folder) ?? []
    if (!matches.length) {
      throw new Error(
        `No manifest in src/modules/manifest-index.ts resolves to src/modules/${folder}`,
      )
    }
    const products = matches.filter((entry) => entry.kind === 'product')
    if (products.length > 1) {
      throw new Error(
        `src/modules/${folder} resolves to multiple product manifests: ${products
          .map((entry) => entry.id)
          .join(', ')}`,
      )
    }
    const primary = products[0] ?? matches[0]
    if (!primary) {
      throw new Error(`src/modules/${folder} has no primary manifest`)
    }
    const layer = primary.layer
    if (layer !== 'base' && layer !== 'advanced' && layer !== 'site') {
      throw new Error(
        `No pack layer on ${primary.id} (src/modules/${folder}). Set layer to 'base', 'advanced', or 'site'.`,
      )
    }
    packs.set(folder, {
      folder,
      moduleId: primary.id,
      layer,
      requires: declaredRequires(primary),
    })
  }
  return packs
}

function collectPageImportPaths(): Set<string> {
  const paths = new Set<string>()
  for (const entry of ALL_MODULE_MANIFESTS) {
    for (const route of entry.admin?.routes ?? []) {
      const page = route.pageImportPath?.trim()
      if (page) paths.add(normalizeSpecifier(page))
    }
    for (const route of entry.publicRoutes ?? []) {
      const page = route.pageImportPath?.trim()
      if (page) paths.add(normalizeSpecifier(page))
    }
    for (const route of entry.apiRoutes ?? []) {
      const page = route.routeImportPath?.trim()
      if (page) paths.add(normalizeSpecifier(page))
    }
  }
  return paths
}

async function listSourceFiles(): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (toPosix(path.relative(ROOT, full)) === 'src/generated') continue
        await walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || entry.name.endsWith('.d.ts')) continue
      out.push(full)
    }
  }
  await walk(SRC)
  return out
}

function literalText(node: ts.Node | undefined): string | null {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

function lineOf(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function importDeclarationKind(node: ts.ImportDeclaration): ImportKind {
  if (node.importClause?.isTypeOnly) return 'type'
  const bindings = node.importClause?.namedBindings
  if (node.importClause?.name) return 'static'
  if (bindings && ts.isNamedImports(bindings)) {
    if (bindings.elements.length > 0 && bindings.elements.every((el) => el.isTypeOnly)) return 'type'
    return 'static'
  }
  return 'static'
}

function exportDeclarationKind(node: ts.ExportDeclaration): ImportKind {
  if (node.isTypeOnly) return 'type'
  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    const elements = node.exportClause.elements
    if (elements.length > 0 && elements.every((el) => el.isTypeOnly)) return 'type'
  }
  return 'static'
}

type RawImport = { specifier: string; importKind: ImportKind; line: number }

function collectImports(sourceFile: ts.SourceFile): RawImport[] {
  const found: RawImport[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      const specifier = literalText(node.moduleSpecifier)
      if (specifier) {
        found.push({
          specifier,
          importKind: importDeclarationKind(node),
          line: lineOf(sourceFile, node),
        })
      }
    } else if (ts.isExportDeclaration(node)) {
      const specifier = literalText(node.moduleSpecifier)
      if (specifier) {
        found.push({
          specifier,
          importKind: exportDeclarationKind(node),
          line: lineOf(sourceFile, node),
        })
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const specifier = literalText(node.moduleReference.expression)
      if (specifier) {
        found.push({
          specifier,
          importKind: node.isTypeOnly ? 'type' : 'static',
          line: lineOf(sourceFile, node),
        })
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = literalText(node.arguments[0])
      if (specifier) {
        found.push({ specifier, importKind: 'dynamic', line: lineOf(sourceFile, node) })
      }
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      const specifier = literalText(node.argument.literal)
      if (specifier) {
        found.push({ specifier, importKind: 'type', line: lineOf(sourceFile, node) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return found
}

function classifySource(rel: string, packs: Map<string, Pack>): SourceInfo {
  const norm = toPosix(rel)
  if (norm === 'src/proxy.ts' || norm === 'src/instrumentation.ts' || norm.startsWith('src/core/')) {
    return { kind: 'core', moduleId: 'core', layer: 'core', requires: new Set() }
  }
  if (norm.startsWith('src/hero/')) {
    return { kind: 'hero', moduleId: 'hero', layer: 'hero', requires: new Set() }
  }
  if (norm.startsWith('src/app/')) {
    return { kind: 'app', moduleId: 'app', layer: 'app', requires: new Set() }
  }
  if (norm.startsWith('src/modules/')) {
    const parts = norm.split('/')
    // `src/modules/<file>.ts` is the catalog index, not a pack folder.
    if (parts.length === 3) {
      return { kind: 'host', moduleId: 'host', layer: 'host', requires: new Set() }
    }
    const folder = parts[2] ?? ''
    const pack = packs.get(folder)
    if (!pack) {
      throw new Error(`Import walk saw src/modules/${folder} but that folder has no pack mapping`)
    }
    return {
      kind: 'module',
      moduleId: pack.moduleId,
      layer: pack.layer,
      requires: pack.requires,
    }
  }
  return { kind: 'host', moduleId: 'host', layer: 'host', requires: new Set() }
}

function isDoor(spec: string): boolean {
  const parsed = parseModuleSpecifier(spec)
  if (!parsed) return false
  if (parsed.rest === 'api' || parsed.rest === 'api.server') return true
  if ((parsed.rest === '' || parsed.rest === 'index') && CLIENT_BARRELS.has(parsed.folder)) return true
  return false
}

function formsFamilyException(source: SourceInfo, targetModuleId: string): boolean {
  return source.moduleId === FORM_PARTICLE_ID && targetModuleId === FORMS_ENGINE_ID
}

function reaches(from: string, to: string, adj: Map<string, Set<string>>): boolean {
  const seen = new Set<string>()
  const stack = [...(adj.get(from) ?? [])]
  while (stack.length) {
    const next = stack.pop()
    if (!next || seen.has(next)) continue
    if (next === to) return true
    seen.add(next)
    for (const edge of adj.get(next) ?? []) stack.push(edge)
  }
  return false
}

function sortReasons(reasons: Iterable<Reason>): Reason[] {
  const present = new Set(reasons)
  return REASON_ORDER.filter((reason) => present.has(reason))
}

function sameReasons(a: readonly Reason[], b: readonly Reason[]): boolean {
  const left = sortReasons(a)
  const right = sortReasons(b)
  return left.length === right.length && left.every((reason, index) => reason === right[index])
}

function classifyHit(input: {
  source: SourceInfo
  targetModuleId: string
  targetLayer: string
  specifier: string
  importKind: ImportKind
  door: boolean
  shimPage: boolean
  cycle: boolean
}): Reason[] {
  const { source, targetModuleId, targetLayer, importKind, door, shimPage, cycle } = input
  // The form particle may import the forms engine. That direction stays legal
  // even when other edges close a cycle through it.
  if (formsFamilyException(source, targetModuleId)) return []

  // A type-only import of a public entry is a public type. Internal type imports stay violations.
  const publicType = importKind === 'type' && (door || (source.kind === 'app' && shimPage))
  if (publicType) return []

  const reasons = new Set<Reason>()
  if (cycle) reasons.add('cycle')

  const targetIsModule = targetModuleId !== 'hero'
  if (source.kind === 'core' || source.kind === 'host') {
    reasons.add('forbidden-layer')
  } else if (source.kind === 'hero') {
    // Hero files may import each other. Module imports stay on public doors.
    if (targetModuleId !== 'hero' && !door && targetIsModule) reasons.add('private-internal')
  } else if (source.kind === 'app') {
    if (!shimPage) reasons.add('forbidden-layer')
  } else if (source.kind === 'module') {
    if (targetLayer === 'hero' || targetModuleId === 'hero') {
      reasons.add('forbidden-layer')
    } else if (source.layer === 'base' && targetLayer !== 'base') {
      reasons.add('forbidden-layer')
    } else if (source.layer === 'advanced' && targetLayer !== 'base') {
      reasons.add('forbidden-layer')
    } else if (source.layer === 'site' && targetLayer !== 'base') {
      reasons.add('forbidden-layer')
    }
    if (!source.requires.has(targetModuleId)) reasons.add('undeclared')
  }

  const heroInternal = source.kind === 'hero' && targetModuleId === 'hero'
  const publicForImporter = door || (source.kind === 'app' && shimPage) || heroInternal
  if (!publicForImporter && source.kind !== 'core' && source.kind !== 'host') {
    reasons.add('private-internal')
  } else if (!publicForImporter && (source.kind === 'core' || source.kind === 'host') && !door) {
    reasons.add('private-internal')
  }

  return sortReasons(reasons)
}

function detailFor(hit: {
  importKind: ImportKind
  fromModule: string
  fromLayer: string
  toModule: string
  toLayer: string
  reasons: Reason[]
}): string {
  const via =
    hit.importKind === 'type'
      ? 'type-only import'
      : hit.importKind === 'dynamic'
        ? 'dynamic import'
        : 'static import'
  return `${hit.fromModule} (${hit.fromLayer}) → ${hit.toModule} (${hit.toLayer}) ${via}; ${hit.reasons.join(', ')}`
}

function suggestMeta(hit: BoundaryHit): { id: string; note: string } {
  const { from, specifier, reasons, fromModule, toModule } = hit
  const cycleOnly =
    reasons.length === 1 && reasons[0] === 'cycle' && !reasons.includes('private-internal')

  if (fromModule === 'product:maps' && toModule === 'product:events') {
    return {
      id: 'H3',
      note: 'C1 — maps → events (cycle, base → advanced). Phase 2 C1/H3.',
    }
  }
  if (fromModule === 'product:events' && toModule === 'product:maps') {
    return {
      id: 'C1',
      note: 'events → maps outside the public entry (cycle). Phase 2 C1.',
    }
  }
  if (from.startsWith('src/app/') && from.includes('/events/') && toModule === 'product:maps') {
    return {
      id: 'C1',
      note: 'H10 — event route imports maps. Phase 2 C1.',
    }
  }
  if (fromModule === 'product:forms' && toModule === 'product:events') {
    return {
      id: 'C2',
      note: 'forms → events (cycle, base → advanced). Phase 2 C2.',
    }
  }
  if (fromModule === 'product:events' && toModule === 'product:forms' && cycleOnly) {
    return {
      id: 'C2',
      note: 'events → forms public entry participates in the forms ↔ events cycle. Phase 2 C2.',
    }
  }
  if (fromModule === 'product:events' && specifier.includes('/forms/presets')) {
    return {
      id: 'H8',
      note: 'events imports forms/presets instead of @/modules/forms/api. Phase 2 H8.',
    }
  }
  if (fromModule === 'product:forms' && toModule === 'product:email-manager') {
    return {
      id: 'H1',
      note: 'forms optionalRequires email-manager, but this import is still a private file. Stage 4 moves it onto the public door.',
    }
  }
  if (fromModule === 'product:events' && toModule === 'product:email-manager') {
    return {
      id: 'H2',
      note: 'events optionalRequires email-manager, but this import is still a private file. Stage 4 moves it onto the public door.',
    }
  }
  if (fromModule === 'product:payments' && toModule === 'product:subscriptions') {
    return {
      id: 'H4',
      note: 'C3 — payments → subscriptions (base → advanced layer cycle). Phase 2 H4.',
    }
  }
  if (fromModule === 'product:subscriptions' && toModule === 'product:payments' && cycleOnly) {
    return {
      id: 'C3',
      note: 'subscriptions → payments participates in the payments ↔ subscriptions layer cycle. Phase 2 §2.',
    }
  }
  if (fromModule === 'product:profiles' && toModule === 'product:maps') {
    return {
      id: 'H5',
      note: 'profiles optionalRequires product:maps, but this import is still a private file. Stage 4 moves it onto the public door.',
    }
  }
  if (fromModule === 'product:maps' && toModule === 'product:media') {
    return {
      id: 'H6',
      note: 'maps → media is not in maps requires. Phase 2 H6.',
    }
  }
  if (fromModule === 'product:pwa' && toModule === 'product:media') {
    return {
      id: 'H7',
      note: 'pwa → media is not in the pwa manifest. Phase 2 H7.',
    }
  }
  if ((fromModule === 'product:events' || fromModule === 'product:subscriptions') && toModule === 'form') {
    return {
      id: 'H9',
      note: 'advanced pack imports the form particle, which is a separate manifest id. Phase 2 H9.',
    }
  }
  if (
    from.startsWith('src/core/') ||
    from.startsWith('src/app/') ||
    from === 'src/proxy.ts' ||
    from === 'src/instrumentation.ts'
  ) {
    return {
      id: 'H10',
      note: 'Core or App imports a module by literal path. Phase 2 H10.',
    }
  }
  if (from.startsWith('src/') && (fromModule === 'core' || fromModule === 'host' || fromModule === 'app')) {
    return {
      id: 'H10',
      note: 'Host file imports a module by literal path. Phase 2 §1.2 / H10.',
    }
  }
  if (fromModule === 'product:events' && toModule === 'product:subscriptions') {
    return {
      id: 'current',
      note: 'events → subscriptions (advanced → advanced, not on events requires). Phase 2 import graph did not number this edge.',
    }
  }
  if (reasons.length === 1 && reasons[0] === 'cycle') {
    return {
      id: 'current',
      note: `Legal ${fromModule} → ${toModule} import sits in an import cycle. Delete this row when that cycle is cut.`,
    }
  }
  if (reasons.includes('private-internal')) {
    return {
      id: 'current',
      note: `Private ${fromModule} → ${toModule} import on this tree (Phase 2 import graph, no separate H id).`,
    }
  }
  return {
    id: 'current',
    note: `${reasons.join(', ')}: ${fromModule} → ${toModule} on this tree.`,
  }
}

function idRank(id: string): [number, number, string] {
  const match = /^(C|H)(\d+)$/.exec(id)
  if (match?.[1] && match[2]) return [match[1] === 'C' ? 0 : 1, Number(match[2]), id]
  return [2, 0, id]
}

function suggestAllowlist(hits: BoundaryHit[]): AllowlistFile {
  const byKey = new Map<string, BoundaryHit>()
  for (const hit of hits) {
    if (!hit.reasons.length) continue
    if (toPosix(hit.from).includes('__boundary-probe')) continue
    const key = `${hit.from}\0${hit.specifier}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, hit)
      continue
    }
    prev.reasons = sortReasons([...prev.reasons, ...hit.reasons])
  }
  const entries: AllowEntry[] = [...byKey.values()].map((hit) => {
    const meta = suggestMeta(hit)
    return {
      id: meta.id,
      from: hit.from,
      specifier: hit.specifier,
      reasons: hit.reasons,
      note: meta.note,
    }
  })
  entries.sort((a, b) => {
    const ar = idRank(a.id)
    const br = idRank(b.id)
    if (ar[0] !== br[0]) return ar[0] - br[0]
    if (ar[1] !== br[1]) return ar[1] - br[1]
    if (a.from !== b.from) return a.from < b.from ? -1 : 1
    return a.specifier < b.specifier ? -1 : a.specifier > b.specifier ? 1 : 0
  })
  return {
    $comment:
      'Stage 0 known module-boundary violations (ARCHITECTURE_AUDIT_PHASE_2 C1, C2, H1–H10, plus every other illegal edge on this tree). A row matches one source file and one specifier. Later remediation stages delete the rows they fix. Do not add a blanket module-to-module exemption — a new file must fail.',
    entries,
  }
}

async function loadAllowlist(): Promise<AllowEntry[]> {
  const raw = await readFile(ALLOWLIST_PATH, 'utf8')
  const parsed = JSON.parse(raw) as AllowlistFile
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error('scripts/module-boundary-allowlist.json must contain an entries array')
  }
  const seen = new Set<string>()
  for (const entry of parsed.entries) {
    if (!entry || typeof entry.id !== 'string' || typeof entry.from !== 'string') {
      throw new Error('Allowlist entries need string id and from')
    }
    if (typeof entry.specifier !== 'string' || !Array.isArray(entry.reasons)) {
      throw new Error(`Allowlist entry ${entry.id} ${entry.from} needs specifier and reasons`)
    }
    const key = `${toPosix(entry.from)}\0${entry.specifier}`
    if (seen.has(key)) throw new Error(`Duplicate allowlist row ${entry.from} → ${entry.specifier}`)
    seen.add(key)
    entry.from = toPosix(entry.from)
    entry.reasons = sortReasons(entry.reasons)
  }
  return parsed.entries
}

type Collected = {
  filesChecked: number
  hits: BoundaryHit[]
}

async function collectClassifiedHits(): Promise<Collected> {
  const folderNames = (await readdir(path.join(SRC, 'modules'), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
  const packs = buildPacks(folderNames)
  const folders = new Set(folderNames)
  const pageImportPaths = collectPageImportPaths()
  const files = await listSourceFiles()
  const pending: Array<
    Omit<BoundaryHit, 'reasons' | 'detail'> & { source: SourceInfo; door: boolean; shimPage: boolean }
  > = []

  for (const file of files) {
    const rel = toPosix(path.relative(ROOT, file))
    const text = await readFile(file, 'utf8')
    const source = classifySource(rel, packs)
    const scriptKind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, scriptKind)
    for (const item of collectImports(sourceFile)) {
      const resolved = aliasForSpecifier(rel, item.specifier, folders)
      if (!resolved) continue
      if (isCatalogManifestImport(rel, resolved)) continue
      if (!resolved.startsWith('@/modules/') && !isHeroSpecifier(resolved)) continue
      const hero = isHeroSpecifier(resolved)
      const parsed = hero ? null : parseModuleSpecifier(resolved)
      if (!hero && !parsed) continue
      const pack = parsed ? packs.get(parsed.folder) : undefined
      const targetModuleId = hero ? 'hero' : (pack?.moduleId ?? `unknown:${parsed?.folder ?? 'module'}`)
      const targetLayer = hero ? 'hero' : (pack?.layer ?? 'unknown')
      if (source.kind === 'module' && !hero && source.moduleId === targetModuleId) continue
      const door = isDoor(resolved)
      const shimPage = pageImportPaths.has(normalizeSpecifier(resolved))
      pending.push({
        from: rel,
        line: item.line,
        specifier: item.specifier,
        door,
        shimPage,
        importKind: item.importKind,
        fromKind: source.kind,
        fromModule: source.moduleId,
        fromLayer: source.layer,
        toModule: targetModuleId,
        toLayer: targetLayer,
        source,
      })
    }
  }

  const adj = new Map<string, Set<string>>()
  for (const hit of pending) {
    if (hit.fromKind !== 'module' || hit.toModule === hit.fromModule) continue
    const edges = adj.get(hit.fromModule) ?? new Set<string>()
    edges.add(hit.toModule)
    adj.set(hit.fromModule, edges)
  }

  const hits: BoundaryHit[] = pending.map((hit) => {
    const cycle =
      hit.fromKind === 'module' &&
      hit.toModule !== hit.fromModule &&
      reaches(hit.toModule, hit.fromModule, adj)
    const reasons = classifyHit({
      source: hit.source,
      targetModuleId: hit.toModule,
      targetLayer: hit.toLayer,
      specifier: hit.specifier,
      importKind: hit.importKind,
      door: hit.door,
      shimPage: hit.shimPage,
      cycle,
    })
    return {
      from: hit.from,
      line: hit.line,
      specifier: hit.specifier,
      importKind: hit.importKind,
      fromKind: hit.fromKind,
      fromModule: hit.fromModule,
      fromLayer: hit.fromLayer,
      toModule: hit.toModule,
      toLayer: hit.toLayer,
      reasons,
      detail: reasons.length
        ? detailFor({
            importKind: hit.importKind,
            fromModule: hit.fromModule,
            fromLayer: hit.fromLayer,
            toModule: hit.toModule,
            toLayer: hit.toLayer,
            reasons,
          })
        : '',
    }
  })

  return { filesChecked: files.length, hits }
}

export async function auditModuleBoundaries(): Promise<BoundaryReport> {
  const [{ filesChecked, hits }, allowlist] = await Promise.all([
    collectClassifiedHits(),
    loadAllowlist(),
  ])

  const allowByKey = new Map<string, AllowEntry>()
  for (const entry of allowlist) allowByKey.set(`${entry.from}\0${entry.specifier}`, entry)

  const foundReasons = new Map<string, Reason[]>()
  for (const hit of hits) {
    if (!hit.reasons.length) continue
    const key = `${hit.from}\0${hit.specifier}`
    foundReasons.set(key, sortReasons([...(foundReasons.get(key) ?? []), ...hit.reasons]))
  }

  const violations: BoundaryHit[] = []
  let allowlisted = 0
  let legal = 0
  const usedKeys = new Set<string>()
  for (const hit of hits) {
    if (!hit.reasons.length) {
      legal += 1
      continue
    }
    const key = `${hit.from}\0${hit.specifier}`
    const entry = allowByKey.get(key)
    if (entry) {
      allowlisted += 1
      usedKeys.add(key)
      continue
    }
    violations.push(hit)
  }

  const staleAllowlist = allowlist.filter((entry) => !usedKeys.has(`${entry.from}\0${entry.specifier}`))
  const driftedAllowlist: BoundaryReport['driftedAllowlist'] = []
  for (const entry of allowlist) {
    const key = `${entry.from}\0${entry.specifier}`
    const found = foundReasons.get(key)
    if (!found) continue
    if (!sameReasons(entry.reasons, found)) driftedAllowlist.push({ entry, found })
  }

  violations.sort(
    (a, b) => a.from.localeCompare(b.from) || a.line - b.line || a.specifier.localeCompare(b.specifier),
  )

  return {
    filesChecked,
    crossModuleImports: hits.length,
    legal,
    allowlisted,
    violations,
    staleAllowlist,
    driftedAllowlist,
  }
}

function printReport(report: BoundaryReport): boolean {
  const problems =
    report.violations.length + report.staleAllowlist.length + report.driftedAllowlist.length
  if (!problems) {
    console.log(
      `verify-module-boundaries: pass (${report.filesChecked} files, ${report.crossModuleImports} cross-module imports, ${report.legal} legal, ${report.allowlisted} allowlisted)`,
    )
    return true
  }
  console.error(`verify-module-boundaries: ${report.violations.length} violation(s)`)
  for (const hit of report.violations) {
    console.error(`${hit.from}:${hit.line} ${hit.importKind} ${hit.specifier}`)
    console.error(`  ${hit.detail}`)
  }
  if (report.staleAllowlist.length) {
    console.error(`verify-module-boundaries: ${report.staleAllowlist.length} stale allowlist row(s)`)
    for (const entry of report.staleAllowlist) {
      console.error(`  ${entry.id} ${entry.from} → ${entry.specifier}`)
    }
  }
  if (report.driftedAllowlist.length) {
    console.error(`verify-module-boundaries: ${report.driftedAllowlist.length} allowlist reason drift(s)`)
    for (const drift of report.driftedAllowlist) {
      console.error(
        `  ${drift.entry.id} ${drift.entry.from} → ${drift.entry.specifier}: listed ${drift.entry.reasons.join(', ')}; found ${drift.found.join(', ')}`,
      )
    }
  }
  return false
}

function invokedDirectly(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const invoked = path.resolve(entry).replace(/\\/g, '/').toLowerCase()
  const self = fileURLToPath(import.meta.url).replace(/\\/g, '/').toLowerCase()
  return invoked === self
}

async function main(): Promise<void> {
  if (process.argv.includes('--suggest')) {
    const { hits } = await collectClassifiedHits()
    const json = `${JSON.stringify(suggestAllowlist(hits), null, 2)}\n`
    const outFlag = process.argv.indexOf('--out')
    const outPath = outFlag >= 0 ? process.argv[outFlag + 1] : undefined
    if (outPath) {
      await writeFile(outPath, json, 'utf8')
      console.error(`wrote ${outPath}`)
      return
    }
    console.log(json)
    return
  }

  const report = await auditModuleBoundaries()
  if (!printReport(report)) process.exitCode = 1
}

if (invokedDirectly()) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
