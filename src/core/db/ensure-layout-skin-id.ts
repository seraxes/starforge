/**
 * Ensure `sf_layouts.skin_id` exists (idempotent).
 * Soft-heals DBs that haven’t run `db:core:push` yet after the Base/skin ownership change.
 */
import 'server-only'

import { pool } from './index'

let ensured: Promise<void> | null = null

export function ensureLayoutSkinIdColumn(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await pool.query(`
        ALTER TABLE "sf_layouts"
        ADD COLUMN IF NOT EXISTS "skin_id" text
      `)
    })().catch((error) => {
      ensured = null
      throw error
    })
  }
  return ensured
}
