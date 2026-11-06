/**
 * Align root package.json dependencies with starforge.modules.json
 * registryPackages for the active allowlist, then npm install + modules:generate.
 *
 * STARFORGE_MODULE_SOURCE=file|registry (default: file)
 *   file     → "file:<localPath>" (monorepo)
 *   registry → "@starforge/module-*: <version>" from GitHub Packages
 *
 * Usage: npm run modules:sync
 */

import { spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  ROOT,
  normalizeRegistryPackages,
  readAllowlistFile,
  resolveRequestedModuleIds,
  type RegistryPackageSpec,
} from './lib/module-allowlist.mts'

const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json')

type PackageJson = {
  dependencies?: Record<string, string>
  [key: string]: unknown
}

function moduleSource(): 'file' | 'registry' {
  const raw = (process.env.STARFORGE_MODULE_SOURCE ?? 'file').trim().toLowerCase()
  return raw === 'registry' ? 'registry' : 'file'
}

function depSpec(spec: RegistryPackageSpec, source: 'file' | 'registry'): string {
  if (source === 'registry') return spec.version.startsWith('^') || spec.version.startsWith('~')
    ? spec.version
    : spec.version
  const rel = spec.localPath.replace(/\\/g, '/')
  return `file:${rel}`
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

function runNpm(args: string[]): void {
  const result = spawnSync('npm', args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`[modules:sync] npm ${args.join(' ')} failed (exit ${result.status})`)
  }
}

async function main(): Promise<void> {
  const source = moduleSource()
  const { flavor, requested, source: allowSource } = await resolveRequestedModuleIds()
  const file = await readAllowlistFile()
  const registry = normalizeRegistryPackages(file.registryPackages)
  const allowSet = new Set(requested)

  console.log(
    `[modules:sync] flavor=${flavor} allowlist=${allowSource} source=${source} ids=${requested.length}`,
  )

  const pkgRaw = await readFile(PACKAGE_JSON_PATH, 'utf8')
  const pkg = JSON.parse(pkgRaw) as PackageJson
  const deps = { ...(pkg.dependencies ?? {}) }

  const knownPackageNames = new Set(
    Object.values(registry).map((s) => s.name),
  )

  // Remove registry-managed deps that are not allowlisted.
  for (const [id, spec] of Object.entries(registry)) {
    if (allowSet.has(id)) continue
    if (deps[spec.name]) {
      console.log(`[modules:sync] remove ${spec.name} (not in allowlist)`)
      delete deps[spec.name]
    }
  }

  // Also drop any @starforge/module-* that appears in knownPackageNames but…
  // (already handled via registry map)

  // Add / update allowlisted packaged modules.
  for (const [id, spec] of Object.entries(registry)) {
    if (!allowSet.has(id)) continue
    if (source === 'file') {
      const abs = path.join(ROOT, spec.localPath)
      if (!(await pathExists(abs))) {
        throw new Error(
          `[modules:sync] localPath missing for ${id}: ${spec.localPath}`,
        )
      }
    }
    const next = depSpec(spec, source)
    if (deps[spec.name] !== next) {
      console.log(`[modules:sync] set ${spec.name} → ${next}`)
      deps[spec.name] = next
    } else {
      console.log(`[modules:sync] keep ${spec.name} @ ${next}`)
    }
  }

  // Drop orphaned @starforge/module-* not in registryPackages (safety).
  for (const name of Object.keys(deps)) {
    if (!name.startsWith('@starforge/module-')) continue
    if (knownPackageNames.has(name)) continue
    console.log(`[modules:sync] remove orphan ${name}`)
    delete deps[name]
  }

  pkg.dependencies = Object.fromEntries(
    Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)),
  )

  await writeFile(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
  console.log('[modules:sync] wrote package.json')

  if (source === 'registry' && !process.env.NODE_AUTH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.warn(
      '[modules:sync] STARFORGE_MODULE_SOURCE=registry but NODE_AUTH_TOKEN/GITHUB_TOKEN unset — npm install may fail for private packages',
    )
  }

  runNpm(['install'])
  runNpm(['run', 'modules:generate'])
  console.log('[modules:sync] done')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
