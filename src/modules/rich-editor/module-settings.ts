/**
 * product:rich-editor settings shape + normalize (client-safe).
 * Load/save live in pack-settings.ts (server-only).
 */

export type RichEditorModuleSettings = {
  /** When false, emoji insert controls are hidden site-wide. Default on. */
  emojiInsertEnabled: boolean
}

export const DEFAULT_RICH_EDITOR_MODULE_SETTINGS: RichEditorModuleSettings = {
  emojiInsertEnabled: true,
}

function parseBool(raw: unknown, fallback: boolean): boolean {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false') return false
  if (raw === true || raw === 1 || raw === '1' || raw === 'true') return true
  return fallback
}

export function normalizeRichEditorModuleSettings(
  raw: unknown,
): RichEditorModuleSettings {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  return {
    emojiInsertEnabled: parseBool(
      obj.emojiInsertEnabled,
      DEFAULT_RICH_EDITOR_MODULE_SETTINGS.emojiInsertEnabled,
    ),
  }
}
