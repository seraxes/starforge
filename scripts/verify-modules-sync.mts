/**
 * Smoke-check Module Manager install wiring (allowlist presets + registryPackages + scripts).
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  ROOT,
  normalizeRegistryPackages,
  resolveRequestedModuleIds,
} from './lib/module-allowlist.mts'

const here = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const resolved = await resolveRequestedModuleIds()
  assert.equal(resolved.source, 'preset')
  assert.ok(resolved.requested.includes('platform:better-auth'))
  assert.ok(resolved.requested.includes('page-content'))

  const raw = JSON.parse(await readFile(path.join(ROOT, 'starforge.modules.json'), 'utf8'))
  const registry = normalizeRegistryPackages(raw.registryPackages)
  assert.ok(registry['notice-bar']?.name === '@starforge/module-notice-bar')
  assert.ok(registry['product:consent']?.name === '@starforge/module-consent')

  const lean = raw.presets?.lean
  assert.ok(Array.isArray(lean) && lean.length > 0)
  assert.ok(!lean.includes('product:marketplace'))
  assert.ok(!lean.includes('notice-bar'))

  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  assert.ok(pkg.scripts['modules:sync'])
  assert.ok(pkg.scripts['modules:wizard'])
  assert.ok(pkg.dependencies['@starforge/module-notice-bar']?.startsWith('file:'))
  assert.ok(pkg.dependencies['@starforge/module-consent']?.startsWith('file:'))

  // lean allowlist must generate without unknown ids
  process.env.SF_MODULES = lean.join(',')
  const { spawnSync } = await import('node:child_process')
  const gen = spawnSync('npx', ['tsx', path.join(here, 'generate-module-registry.mts')], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  delete process.env.SF_MODULES
  assert.equal(gen.status, 0, gen.stderr || gen.stdout)

  // restore core preset generate
  const restore = spawnSync('npm', ['run', 'modules:generate'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: process.env,
  })
  assert.equal(restore.status, 0, restore.stderr || restore.stdout)

  console.log('verify-modules-sync: pass')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
