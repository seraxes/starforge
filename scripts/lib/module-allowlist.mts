/**
 * Shared allowlist / flavor / registry-package helpers for
 * modules:generate, modules:sync, and modules:wizard.
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const ALLOWLIST_PATH = path.join(ROOT, 'starforge.modules.json')

export type RegistryPackageSpec = {
  name: string
  version: string
  /** Repo-relative path for file: installs (monorepo). */
  localPath: string
}

export type AllowlistFile = {
  $comment?: string
  flavor?: string
  modules?: unknown
  presets?: Record<string, unknown>
  registryPackages?: Record<string, RegistryPackageSpec>
}

export function parseSfModulesEnv(raw: string | undefined): string[] | null {
  if (raw == null || !raw.trim()) return null
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function asIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const row of raw) {
    if (typeof row === 'string' && row.trim()) out.push(row.trim())
  }
  return out
}

export function uniqSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
}

export async function readAllowlistFile(): Promise<AllowlistFile> {
  const raw = await readFile(ALLOWLIST_PATH, 'utf8')
  return JSON.parse(raw) as AllowlistFile
}

/**
 * Resolve the active module id list from env or allowlist file.
 * Prefer `presets[flavor]` when defined; otherwise `modules`.
 */
export async function resolveRequestedModuleIds(): Promise<{
  flavor: string
  requested: string[]
  source: 'env' | 'preset' | 'modules'
  file: AllowlistFile | null
}> {
  const envList = parseSfModulesEnv(process.env.SF_MODULES)
  if (envList) {
    return { flavor: 'env', requested: envList, source: 'env', file: null }
  }

  const file = await readAllowlistFile()
  const flavor =
    typeof file.flavor === 'string' && file.flavor.trim() ? file.flavor.trim() : 'core'
  const presetRaw = file.presets?.[flavor]
  if (presetRaw !== undefined) {
    const requested = asIdList(presetRaw)
    if (!requested.length) {
      throw new Error(
        `[modules] presets.${flavor} must be a non-empty string array (or omit the preset)`,
      )
    }
    return { flavor, requested, source: 'preset', file }
  }

  const requested = asIdList(file.modules)
  return { flavor, requested, source: 'modules', file }
}

export function normalizeRegistryPackages(
  raw: AllowlistFile['registryPackages'],
): Record<string, RegistryPackageSpec> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, RegistryPackageSpec> = {}
  for (const [id, spec] of Object.entries(raw)) {
    if (!spec || typeof spec !== 'object') continue
    const name = typeof spec.name === 'string' ? spec.name.trim() : ''
    const version = typeof spec.version === 'string' ? spec.version.trim() : ''
    const localPath = typeof spec.localPath === 'string' ? spec.localPath.trim() : ''
    if (!name || !version || !localPath) {
      throw new Error(
        `[modules] registryPackages.${id} needs name, version, and localPath`,
      )
    }
    out[id] = { name, version, localPath }
  }
  return out
}

export async function writeAllowlistFile(file: AllowlistFile): Promise<void> {
  const body = `${JSON.stringify(file, null, 2)}\n`
  await writeFile(ALLOWLIST_PATH, body, 'utf8')
}
