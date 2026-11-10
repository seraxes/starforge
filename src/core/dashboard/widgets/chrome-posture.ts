/**
 * Site Chrome glance: offline, indexing / robots, captcha.
 * One row of posture — not a settings form.
 */

import { formatCaptchaPosture } from './security-posture'

export type ChromePostureKey = 'site' | 'indexing' | 'captcha'

export type ChromePostureRow = {
  key: ChromePostureKey
  label: string
  value: string
  /** Warn chip for offline and discouraged indexing. Captcha off is a normal posture. */
  warn: boolean
}

function directiveValue(line: string, name: string): string | null {
  const prefix = `${name}:`
  if (!line.startsWith(prefix)) return null
  return line.slice(prefix.length).trim()
}

/**
 * True when public pages ask crawlers to stay out:
 * `noindex` / `none` in the default robots meta, or `User-agent: *` + `Disallow: /`
 * without an `Allow: /` in that group.
 */
export function indexingDiscouraged(robotsMeta: string, robotsTxt: string): boolean {
  const meta = robotsMeta.toLowerCase()
  if (/\bnoindex\b/.test(meta) || /(^|[,\s])none($|[,\s])/.test(meta)) return true

  const lines = robotsTxt
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim().toLowerCase())
    .filter(Boolean)

  let star = false
  let disallowRoot = false
  let allowRoot = false
  const blocksAll = () => star && disallowRoot && !allowRoot

  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      if (blocksAll()) return true
      star = line.slice('user-agent:'.length).trim() === '*'
      disallowRoot = false
      allowRoot = false
      continue
    }
    if (!star) continue
    if (directiveValue(line, 'disallow') === '/') disallowRoot = true
    if (directiveValue(line, 'allow') === '/') allowRoot = true
  }
  return blocksAll()
}

export function formatSiteOnline(offlineEnabled: boolean): string {
  return offlineEnabled ? 'Offline' : 'Online'
}

export function formatIndexingPosture(robotsMeta: string, robotsTxt: string): string {
  return indexingDiscouraged(robotsMeta, robotsTxt) ? 'Discouraged' : 'Indexing'
}

export function assembleChromePosture(input: {
  offlineEnabled: boolean
  robotsMeta: string
  robotsTxt: string
  captchaEnabled: boolean
  captchaProvider: string | null | undefined
}): ChromePostureRow[] {
  const indexing = formatIndexingPosture(input.robotsMeta, input.robotsTxt)
  return [
    {
      key: 'site',
      label: 'Site',
      value: formatSiteOnline(input.offlineEnabled),
      warn: input.offlineEnabled,
    },
    {
      key: 'indexing',
      label: 'Indexing',
      value: indexing,
      warn: indexing === 'Discouraged',
    },
    {
      key: 'captcha',
      label: 'Captcha',
      value: formatCaptchaPosture(input.captchaEnabled, input.captchaProvider),
      warn: false,
    },
  ]
}
