import 'server-only'

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { ENV_EDITOR_FIELDS, ENV_EDITOR_KEY_SET } from './catalog'
import { envEditorIsWritable } from './mode'
import { parseEnvFile, serializeEnvFile, type EnvMap } from './parse'
import type { EnvEditorRow, EnvEditorSnapshot } from './types'

export type { EnvEditorRow, EnvEditorSnapshot } from './types'

const OVERLAY_FILENAME = '.env.local'

function projectRoot(): string {
  return process.cwd()
}

export function getEnvOverlayPath(): string {
  return path.join(projectRoot(), OVERLAY_FILENAME)
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function readEnvOverlayMap(): Promise<{ map: EnvMap; exists: boolean; path: string }> {
  const overlayPath = getEnvOverlayPath()
  const exists = await fileExists(overlayPath)
  if (!exists) {
    return { map: {}, exists: false, path: overlayPath }
  }
  const raw = await readFile(overlayPath, 'utf8')
  return { map: parseEnvFile(raw), exists: true, path: overlayPath }
}

function maskSecret(value: string): string {
  if (!value) return ''
  if (value.length <= 4) return '••••'
  return `•••••••• (${value.length} chars)`
}

export async function loadEnvEditorSnapshot(): Promise<EnvEditorSnapshot> {
  const { map: overlay, exists, path: overlayPath } = await readEnvOverlayMap()
  const writable = envEditorIsWritable()
  const rows: EnvEditorRow[] = ENV_EDITOR_FIELDS.map((field) => {
    const effective = process.env[field.key] ?? ''
    const overlayValue = overlay[field.key] ?? ''
    const isSet = Boolean(effective)
    return {
      field,
      effective,
      overlay: overlayValue,
      isSet,
      displayValue: field.secret ? (isSet ? maskSecret(effective) : '') : effective,
    }
  })

  return {
    rows,
    overlayPath,
    overlayExists: exists,
    writable,
    writeMode: writable ? 'write' : 'readonly',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  }
}

export type EnvEditorSaveInput = {
  /** Submitted values keyed by allowlisted env key. */
  values: Record<string, string>
}

export type EnvEditorSaveResult =
  | { ok: true; changedKeys: string[]; overlayPath: string }
  | { ok: false; error: string }

/**
 * Merge allowlisted submitted values into `.env.local`.
 * Secrets: empty submit keeps prior overlay value, else prior effective if overlay missing.
 * Non-secrets: empty removes the key from the overlay (falls through to `.env` / host).
 */
export async function saveEnvOverlay(input: EnvEditorSaveInput): Promise<EnvEditorSaveResult> {
  if (!envEditorIsWritable()) {
    return {
      ok: false,
      error:
        'Environment editor is read-only in this process. Set STARFORGE_ENV_EDITOR=write to allow saves (not recommended on shared production).',
    }
  }

  const { map: existing, path: overlayPath } = await readEnvOverlayMap()
  const next: EnvMap = { ...existing }
  const changedKeys: string[] = []

  for (const field of ENV_EDITOR_FIELDS) {
    if (!(field.key in input.values)) continue
    if (!ENV_EDITOR_KEY_SET.has(field.key)) continue

    const submitted = input.values[field.key] ?? ''
    const prevOverlay = existing[field.key]
    const prevEffective = process.env[field.key] ?? ''

    if (field.secret) {
      // Empty secret field = keep existing overlay / host value (never wipe by accident).
      if (!submitted.trim()) continue
      if (submitted === prevOverlay) continue
      next[field.key] = submitted
      changedKeys.push(field.key)
      continue
    }

    // Non-secret: empty removes overlay key (fall through to `.env` / host).
    if (!submitted.trim()) {
      if (field.key in next) {
        delete next[field.key]
        changedKeys.push(field.key)
      }
      continue
    }
    // Avoid materializing unchanged host/.env values into the overlay on a no-op Save.
    if (prevOverlay === undefined && submitted === prevEffective) continue
    if (prevOverlay === submitted) continue
    next[field.key] = submitted
    changedKeys.push(field.key)
  }

  // Drop any non-allowlisted keys? Keep them — hand-edited extras stay.
  // But ensure we don't accidentally strip them: `next` started from existing.

  const order = [
    ...ENV_EDITOR_FIELDS.map((f) => f.key),
    ...Object.keys(next).filter((k) => !ENV_EDITOR_KEY_SET.has(k)),
  ]

  const body = serializeEnvFile(next, order)
  await mkdir(path.dirname(overlayPath), { recursive: true })
  await writeFile(overlayPath, body, { encoding: 'utf8', mode: 0o600 })

  return { ok: true, changedKeys: [...new Set(changedKeys)], overlayPath }
}
