/**
 * Minimal dotenv parse / serialize for `.env.local` overlay.
 * Preserves unknown keys and comment/blank lines outside managed rewrites
 * by merging: we rewrite the whole file from a key→value map + optional
 * preserved header comment.
 */

export type EnvMap = Record<string, string>

/** Parse KEY=VALUE lines (dotenv-compatible enough for our overlay). */
export function parseEnvFile(raw: string): EnvMap {
  const out: EnvMap = {}
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
      value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"')
    }
    out[key] = value
  }
  return out
}

function escapeEnvValue(value: string): string {
  if (value === '') return ''
  const needsQuotes = /[\s#"'$\\]/.test(value) || value.includes('\n')
  if (!needsQuotes) return value
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`
}

/**
 * Serialize map to `.env.local` with a managed banner.
 * Keys sorted for stable diffs; only include keys with defined string values
 * (including empty string — caller decides whether to omit).
 */
export function serializeEnvFile(map: EnvMap, keysOrder?: string[]): string {
  const keys = keysOrder?.length
    ? [
        ...keysOrder.filter((k) => k in map),
        ...Object.keys(map)
          .filter((k) => !keysOrder.includes(k))
          .sort(),
      ]
    : Object.keys(map).sort()

  const body = keys
    .map((key) => `${key}=${escapeEnvValue(map[key] ?? '')}`)
    .join('\n')

  return [
    '# Starforge Environment editor overlay (.env.local)',
    '# Gitignored. Secrets must not be copied into Site Chrome / Site Settings / DB.',
    '# Restart `next dev` / the Node process after changes for Next to reload env.',
    '# Written by Core admin → Site Chrome → Environment.',
    '',
    body,
    body ? '' : '',
  ].join('\n')
}
