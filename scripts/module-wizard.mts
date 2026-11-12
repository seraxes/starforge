/**
 * Interactive Module Manager wizard:
 * pick packs → write starforge.modules.json flavor/modules → modules:sync.
 *
 * Non-interactive: SF_MODULES_WIZARD_IDS=id1,id2 or --yes with current flavor.
 *
 * Usage: npm run modules:wizard
 */

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

import { closeModuleRequires } from '../src/core/modules/requires-graph.ts'
import { ALL_MODULE_MANIFESTS } from '../src/modules/manifest-index.ts'
import {
  asIdList,
  readAllowlistFile,
  writeAllowlistFile,
  uniqSorted,
} from './lib/module-allowlist.mts'
import { spawnSync } from 'node:child_process'
import { ROOT } from './lib/module-allowlist.mts'

const FIXED_REQUIRED = ALL_MODULE_MANIFESTS.filter((e) => e.required).map((e) => e.id)

function parseArgIds(): string[] | null {
  const eq = process.argv.find((a) => a.startsWith('--ids='))
  if (eq) {
    return eq
      .slice('--ids='.length)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  const env = process.env.SF_MODULES_WIZARD_IDS
  if (env?.trim()) {
    return env
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return null
}

function runSync(): void {
  const result = spawnSync('npm', ['run', 'modules:sync'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`[modules:wizard] modules:sync failed (exit ${result.status})`)
  }
}

async function promptSelect(current: Set<string>): Promise<string[]> {
  const optional = ALL_MODULE_MANIFESTS.filter((e) => !e.required).sort((a, b) =>
    a.id.localeCompare(b.id),
  )

  console.log('\nStarforge Module Manager wizard')
  console.log('Required (always on):', FIXED_REQUIRED.join(', '))
  console.log('\nToggle optional packs (Enter = keep default Y/n shown):\n')

  const rl = createInterface({ input, output })
  const chosen = new Set<string>(FIXED_REQUIRED)

  try {
    for (const entry of optional) {
      const on = current.has(entry.id)
      const hint = on ? 'Y/n' : 'y/N'
      const answer = (
        await rl.question(`  [${hint}] ${entry.id} — ${entry.label}: `)
      )
        .trim()
        .toLowerCase()

      let enable = on
      if (answer === 'y' || answer === 'yes') enable = true
      else if (answer === 'n' || answer === 'no') enable = false
      // empty → keep default (on)

      if (enable) chosen.add(entry.id)
    }
  } finally {
    rl.close()
  }

  return uniqSorted([...chosen])
}

async function main(): Promise<void> {
  const file = await readAllowlistFile()
  const flavor =
    typeof file.flavor === 'string' && file.flavor.trim() ? file.flavor.trim() : 'core'
  const presetIds = asIdList(file.presets?.[flavor])
  const fallbackIds = asIdList(file.modules)
  const currentList = presetIds.length ? presetIds : fallbackIds
  const current = new Set(currentList)

  const argIds = parseArgIds()
  const skipPrompt = process.argv.includes('--yes') || Boolean(argIds)

  let selected: string[]
  if (argIds) {
    selected = uniqSorted([...FIXED_REQUIRED, ...argIds])
    console.log(`[modules:wizard] non-interactive ids (${selected.length})`)
  } else if (skipPrompt) {
    selected = uniqSorted([...FIXED_REQUIRED, ...currentList])
    console.log(`[modules:wizard] --yes keeping current allowlist (${selected.length})`)
  } else if (!process.stdin.isTTY) {
    throw new Error(
      '[modules:wizard] stdin is not a TTY — pass --ids=… or SF_MODULES_WIZARD_IDS, or --yes',
    )
  } else {
    selected = await promptSelect(current)
  }

  const known = new Set(ALL_MODULE_MANIFESTS.map((e) => e.id))
  const unknown = selected.filter((id) => !known.has(id))
  if (unknown.length) {
    throw new Error(`[modules:wizard] Unknown ids: ${unknown.join(', ')}`)
  }

  const closed = closeModuleRequires(selected, ALL_MODULE_MANIFESTS)
  if (closed.pulled.length) {
    console.log(`[modules:wizard] pulled requires: ${closed.pulled.join(', ')}`)
  }
  selected = closed.ids

  // --yes with no --ids: keep flavor/presets as-is, only refresh modules[] mirror.
  const interactiveOrIds = Boolean(argIds) || !skipPrompt
  const nextFlavor = interactiveOrIds ? 'custom' : flavor
  const presets = {
    ...(file.presets && typeof file.presets === 'object' ? file.presets : {}),
  }
  if (interactiveOrIds) {
    presets[nextFlavor] = selected
  }

  const next = {
    ...file,
    flavor: nextFlavor,
    presets,
    modules: selected,
  }

  await writeAllowlistFile(next)
  console.log(
    `[modules:wizard] wrote starforge.modules.json flavor=${nextFlavor} (${selected.length} ids)`,
  )

  runSync()
  console.log('[modules:wizard] done')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
