/**
 * Composed Content-Security-Policy (design-security §4).
 * Edge-safe: no server-only imports — shared by next.config, middleware, and
 * the Node route that resolves feature-driven sources.
 */

export const CSP_DIRECTIVES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'connect-src',
  'frame-src',
  'media-src',
  'worker-src',
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
] as const

export type CspDirective = (typeof CSP_DIRECTIVES)[number]

/** Directive → extra sources. Groups merge by union. */
export type CspSources = Partial<Record<CspDirective, string[]>>

/**
 * `report-only` (default for the SF-140 rollout cycle): enforce only the
 * non-fetch floor; send the full composed policy as Report-Only.
 * `enforce`: full composed policy as `Content-Security-Policy`.
 * `off`: floor only, no report-only header.
 */
export type CspMode = 'enforce' | 'report-only' | 'off'

const DIRECTIVE_SET = new Set<string>(CSP_DIRECTIVES)

/** Always on. Non-fetch directives here are also the enforced floor. */
export const CSP_BASELINE: CspSources = {
  'default-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
}

const CSP_FLOOR_DIRECTIVES: CspDirective[] = [
  'object-src',
  'base-uri',
  'form-action',
  'frame-ancestors',
]

/** Next + Payload admin still rely on inline / eval (until nonces). */
export const CSP_RUNTIME: CspSources = {
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'frame-src': ["'self'"],
  'media-src': ["'self'", 'blob:'],
  'worker-src': ["'self'", 'blob:'],
}

export const CSP_TURNSTILE: CspSources = {
  'script-src': ['https://challenges.cloudflare.com'],
  'connect-src': ['https://challenges.cloudflare.com'],
  'frame-src': ['https://challenges.cloudflare.com'],
}

export const CSP_FONT_AWESOME_CDN: CspSources = {
  'style-src': ['https://cdnjs.cloudflare.com'],
  'font-src': ['https://cdnjs.cloudflare.com'],
}

/** Google Analytics 4 / gtag (Google's documented CSP set). */
export const CSP_GOOGLE_ANALYTICS: CspSources = {
  'script-src': ['https://*.googletagmanager.com'],
  'connect-src': [
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    'https://*.googletagmanager.com',
  ],
  'img-src': ['https://*.google-analytics.com', 'https://*.googletagmanager.com'],
}

/**
 * Stylesheet origins whose fonts come from a different host.
 * Same-origin CDN fonts (cdnjs, jsDelivr) are covered by `cssOriginSources`.
 */
const STYLE_FONT_COMPANIONS: Record<string, CspSources> = {
  'https://fonts.googleapis.com': { 'font-src': ['https://fonts.gstatic.com'] },
  'https://use.fontawesome.com': { 'font-src': ['https://use.fontawesome.com'] },
}

/** Script origins that pull styles/fonts/XHR from companion hosts (FA Kits). */
const SCRIPT_COMPANIONS: Record<string, CspSources> = {
  'https://kit.fontawesome.com': {
    'style-src': ['https://ka-f.fontawesome.com'],
    'font-src': ['https://ka-f.fontawesome.com'],
    'connect-src': ['https://ka-f.fontawesome.com'],
  },
}

/** Keyword / scheme / host-source shape we accept from contributions. */
const SAFE_SOURCE = /^(?:'[a-z0-9-]+'|[a-z][a-z0-9+.-]*:|https?:\/\/(?:\*\.)?[a-z0-9.-]+(?::\d+)?)$/i

function isSafeSource(source: string): boolean {
  return SAFE_SOURCE.test(source)
}

/** Union groups; drops unknown directives and anything that could inject `;`. */
export function mergeCspSources(...groups: Array<CspSources | null | undefined>): CspSources {
  const merged = new Map<CspDirective, Set<string>>()
  for (const group of groups) {
    if (!group) continue
    for (const [key, values] of Object.entries(group)) {
      if (!DIRECTIVE_SET.has(key) || !Array.isArray(values)) continue
      const directive = key as CspDirective
      let set = merged.get(directive)
      if (!set) {
        set = new Set()
        merged.set(directive, set)
      }
      for (const raw of values) {
        const value = typeof raw === 'string' ? raw.trim() : ''
        if (value && isSafeSource(value)) set.add(value)
      }
    }
  }
  const out: CspSources = {}
  for (const directive of CSP_DIRECTIVES) {
    const set = merged.get(directive)
    if (set?.size) out[directive] = [...set]
  }
  return out
}

/**
 * `http(s)` origin of an absolute or protocol-relative URL; null for
 * relative / other schemes (already `'self'` or not a fetch).
 */
export function urlOrigin(url: string | null | undefined): string | null {
  const raw = typeof url === 'string' ? url.trim() : ''
  if (!raw) return null
  const absolute = raw.startsWith('//') ? `https:${raw}` : raw
  if (!/^https?:\/\//i.test(absolute)) return null
  try {
    const origin = new URL(absolute).origin
    return origin && origin !== 'null' ? origin : null
  } catch {
    return null
  }
}

/** External stylesheet → style-src (+ font-src on the same CDN, + known companions). */
export function cssOriginSources(url: string): CspSources | null {
  const origin = urlOrigin(url)
  if (!origin) return null
  return mergeCspSources(
    { 'style-src': [origin], 'font-src': [origin] },
    STYLE_FONT_COMPANIONS[origin],
  )
}

/** External script → script-src (+ known companions). */
export function scriptOriginSources(url: string): CspSources | null {
  const origin = urlOrigin(url)
  if (!origin) return null
  return mergeCspSources({ 'script-src': [origin] }, SCRIPT_COMPANIONS[origin])
}

const TAG_ATTR = /<(script|link|iframe)\b[^>]*?\s(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi

/**
 * Origins referenced by raw developer-admin HTML (`<script src>`,
 * `<link href>`, `<iframe src>`). Inline script bodies are not parsed.
 */
export function htmlAssetSources(html: string | null | undefined): CspSources {
  const text = typeof html === 'string' ? html : ''
  if (!text.trim()) return {}
  const groups: Array<CspSources | null> = []
  for (const match of text.matchAll(TAG_ATTR)) {
    const tag = match[1]!.toLowerCase()
    const attr = match[2]!.toLowerCase()
    const url = match[3] ?? match[4] ?? match[5] ?? ''
    if (tag === 'script' && attr === 'src') groups.push(scriptOriginSources(url))
    else if (tag === 'link' && attr === 'href') groups.push(cssOriginSources(url))
    else if (tag === 'iframe' && attr === 'src') {
      const origin = urlOrigin(url)
      if (origin) groups.push({ 'frame-src': [origin] })
    }
  }
  return mergeCspSources(...groups)
}

/** `STARFORGE_MEDIA_STORAGE=s3` → public base (or endpoint) origin for img/media. */
export function mediaStorageCspSources(env: NodeJS.ProcessEnv = process.env): CspSources {
  if ((env.STARFORGE_MEDIA_STORAGE ?? '').trim().toLowerCase() !== 's3') return {}
  const origin =
    urlOrigin(env.S3_PUBLIC_BASE_URL) ?? urlOrigin(env.S3_ENDPOINT)
  if (!origin) return {}
  return { 'img-src': [origin], 'media-src': [origin] }
}

export function resolveCspMode(env: NodeJS.ProcessEnv = process.env): CspMode {
  const raw = (env.STARFORGE_CSP_MODE ?? '').trim().toLowerCase()
  if (raw === 'enforce' || raw === 'off') return raw
  return 'report-only'
}

/** Optional `report-uri` target for violation reports (same-origin path or URL). */
export function resolveCspReportUri(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.STARFORGE_CSP_REPORT_URI ?? '').trim()
  if (!raw || /[\s;,']/.test(raw)) return null
  return raw.startsWith('/') || /^https?:\/\//i.test(raw) ? raw : null
}

export function serializeCsp(
  sources: CspSources,
  options?: { only?: CspDirective[]; reportUri?: string | null },
): string {
  const parts: string[] = []
  for (const directive of options?.only ?? CSP_DIRECTIVES) {
    const values = sources[directive]
    if (values?.length) parts.push(`${directive} ${values.join(' ')}`)
  }
  if (options?.reportUri) parts.push(`report-uri ${options.reportUri}`)
  return parts.join('; ')
}

/**
 * Baseline + runtime + env groups (+ feature sources from Settings / Page
 * Settings when the caller has them). Without `features`, optional
 * integrations (Turnstile, Font Awesome, analytics, Page Settings assets)
 * are not allowed — the static fallback is the strict policy.
 */
export function composeCspSources(features?: CspSources | null): CspSources {
  return mergeCspSources(CSP_BASELINE, CSP_RUNTIME, mediaStorageCspSources(), features)
}

export type CspHeader = { key: string; value: string }

/** Header(s) for the active mode: enforced floor/full policy + optional Report-Only. */
export function buildCspHeaders(options?: {
  features?: CspSources | null
  mode?: CspMode
}): CspHeader[] {
  const mode = options?.mode ?? resolveCspMode()
  const reportUri = resolveCspReportUri()
  const full = composeCspSources(options?.features)

  if (mode === 'enforce') {
    return [{ key: 'Content-Security-Policy', value: serializeCsp(full, { reportUri }) }]
  }

  const headers: CspHeader[] = [
    {
      key: 'Content-Security-Policy',
      value: serializeCsp(full, { only: CSP_FLOOR_DIRECTIVES }),
    },
  ]
  if (mode === 'report-only') {
    headers.push({
      key: 'Content-Security-Policy-Report-Only',
      value: serializeCsp(full, { reportUri }),
    })
  }
  return headers
}
