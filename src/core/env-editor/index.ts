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

export {
  ENV_EDITOR_GATE_COOKIE,
  ENV_EDITOR_GATE_TTL_SEC,
  ENV_EDITOR_GATE_SECRET_MISSING,
  readEnvEditorGate,
  requireEnvEditorGate,
  clearEnvEditorGateCookie,
} from './gate'

export { getEnvEditorWriteMode, envEditorIsWritable } from './mode'
export type { EnvEditorWriteMode } from './mode'

export type { EnvEditorRow, EnvEditorSnapshot } from './types'

export {
  getEnvOverlayPath,
  loadEnvEditorSnapshot,
  readEnvOverlayMap,
  saveEnvOverlay,
} from './store'
export type { EnvEditorSaveResult } from './store'
