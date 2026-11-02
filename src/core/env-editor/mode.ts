/**
 * Write vs read-only policy for the Environment editor.
 * Production defaults to read-only; ops can force write with STARFORGE_ENV_EDITOR=write.
 */

export type EnvEditorWriteMode = 'write' | 'readonly'

export function getEnvEditorWriteMode(): EnvEditorWriteMode {
  const override = (process.env.STARFORGE_ENV_EDITOR ?? '').trim().toLowerCase()
  if (override === 'write') return 'write'
  if (override === 'off' || override === 'readonly') return 'readonly'
  if (process.env.NODE_ENV === 'production') return 'readonly'
  return 'write'
}

export function envEditorIsWritable(): boolean {
  return getEnvEditorWriteMode() === 'write'
}
