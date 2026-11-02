/**
 * Server-only Environment editor surface (gate cookie + `.env.local` store).
 * Import from here in RSC / server actions — never from Client Components.
 * The package root `@/core/env-editor` stays client-safe (catalog / actions / types).
 */
import 'server-only'

export {
  ENV_EDITOR_GATE_COOKIE,
  ENV_EDITOR_GATE_TTL_SEC,
  ENV_EDITOR_GATE_SECRET_MISSING,
  readEnvEditorGate,
  requireEnvEditorGate,
  clearEnvEditorGateCookie,
  setEnvEditorGateCookie,
  verifyDeveloperAdminPassword,
} from './gate'

export {
  getEnvOverlayPath,
  loadEnvEditorSnapshot,
  readEnvOverlayMap,
  saveEnvOverlay,
} from './store'
export type { EnvEditorSaveResult } from './store'
