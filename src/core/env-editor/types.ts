import type { EnvEditorField } from './catalog'

/**
 * Client-safe snapshot/row types for the Environment editor UI.
 * Keep free of `server-only` / `next/headers` so client forms can import them
 * without pulling gate/store into the Pages/client graph.
 */

export type EnvEditorRow = {
  field: EnvEditorField
  /** Effective value from process.env (may come from .env, .env.local, or host). */
  effective: string
  /** Value present in the `.env.local` overlay only (empty if unset there). */
  overlay: string
  /** Whether a non-empty effective value exists (for secret masking). */
  isSet: boolean
  /** Masked display for secrets; plain for non-secrets. */
  displayValue: string
}

export type EnvEditorSnapshot = {
  rows: EnvEditorRow[]
  overlayPath: string
  overlayExists: boolean
  writable: boolean
  writeMode: 'write' | 'readonly'
  nodeEnv: string
}
