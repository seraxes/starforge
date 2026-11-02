/**
 * Client-safe Environment editor barrel.
 *
 * Do **not** re-export gate/store here — they use `server-only` + `next/headers`.
 * Importing this barrel from a Client Component would pull those in and break the
 * App Router segment (looks like a 404 on `/app/admin/site-chrome/environment`).
 * Server code: `@/core/env-editor/server`. Actions: `@/core/env-editor/actions`.
 */

export {
  ENV_EDITOR_FIELDS,
  ENV_EDITOR_GROUPS,
  ENV_EDITOR_KEY_SET,
  getEnvEditorField,
} from './catalog'
export type { EnvEditorField, EnvEditorGroup, EnvEditorGroupId } from './catalog'

export {
  unlockEnvEditorAction,
  lockEnvEditorAction,
  saveEnvEditorAction,
} from './actions'
export type {
  EnvEditorGateActionState,
  EnvEditorSaveActionState,
  EnvEditorLockActionState,
} from './actions'

export { getEnvEditorWriteMode, envEditorIsWritable } from './mode'
export type { EnvEditorWriteMode } from './mode'

export type { EnvEditorRow, EnvEditorSnapshot } from './types'
