/**
 * Smoke check: composed CSP + feature-driven sources + Payload csrf origins (SF-140).
 * Run: npx tsx scripts/verify-csp-sources.mts
 */
import { analyticsAtom } from '../src/core/page-settings/atoms/analytics.ts'
import { customCssJsAtom } from '../src/core/page-settings/atoms/custom-css-js.ts'
import { pageChromeCspSources } from '../src/core/page-settings/csp.ts'
import { emptyResolvedChrome } from '../src/core/page-settings/defaults.ts'
import type { ResolvedPageChrome } from '../src/core/page-settings/types.ts'
import {
  buildCspHeaders,
  composeCspSources,
  mergeCspSources,
  type CspSources,
} from '../src/core/security/csp.ts'
import { buildSecurityHeaders } from '../src/core/security/headers.ts'
import { hasUntrustedOrigin, payloadCsrfOrigins } from '../src/core/security/trusted-origins.ts'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    console.error(msg)
    process.exit(1)
  }
}

function has(sources: CspSources, directive: keyof CspSources, value: string): boolean {
  return Boolean(sources[directive]?.includes(value))
}

function header(headers: Array<{ key: string; value: string }>, key: string): string | undefined {
  return headers.find((h) => h.key === key)?.value
}

const atoms = new Map([
  [analyticsAtom.type, analyticsAtom],
  [customCssJsAtom.type, customCssJsAtom],
])

function collect(
  chrome: Partial<ResolvedPageChrome>,
  options?: { fontAwesomeOn?: boolean; atomsOn?: boolean },
): CspSources {
  return pageChromeCspSources([{ ...emptyResolvedChrome(null), ...chrome }], {
    fontAwesomeOn: options?.fontAwesomeOn ?? true,
    isAtomEnabled: () => options?.atomsOn ?? true,
    getAtom: (type) => atoms.get(type),
  })
}

const saved = {
  STARFORGE_CSP_MODE: process.env.STARFORGE_CSP_MODE,
  STARFORGE_CSP_REPORT_URI: process.env.STARFORGE_CSP_REPORT_URI,
  STARFORGE_MEDIA_STORAGE: process.env.STARFORGE_MEDIA_STORAGE,
  S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
}

function restore(): void {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

try {
  for (const k of Object.keys(saved)) delete process.env[k]

  // Mode: report-only default enforces only the non-fetch floor.
  const reportOnly = buildCspHeaders()
  const floor = header(reportOnly, 'Content-Security-Policy') ?? ''
  const ro = header(reportOnly, 'Content-Security-Policy-Report-Only') ?? ''
  assert(floor.includes("object-src 'none'"), 'floor must enforce object-src none')
  assert(floor.includes("frame-ancestors 'self'"), 'floor must enforce frame-ancestors')
  assert(!floor.includes('default-src') && !floor.includes('script-src'), 'floor must not restrict fetches')
  assert(ro.includes("default-src 'self'") && ro.includes('script-src'), 'report-only must carry full policy')
  assert(!ro.includes('challenges.cloudflare.com'), 'Turnstile must be feature-driven, not static')

  process.env.STARFORGE_CSP_MODE = 'enforce'
  process.env.STARFORGE_CSP_REPORT_URI = '/api/csp-report'
  const enforced = buildCspHeaders({ features: { 'style-src': ['https://cdnjs.cloudflare.com'] } })
  assert(enforced.length === 1, 'enforce mode sends one header')
  const full = header(enforced, 'Content-Security-Policy') ?? ''
  assert(full.includes("default-src 'self'"), 'enforce must send full policy')
  assert(full.includes("style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com"), 'feature source merged')
  assert(full.endsWith('report-uri /api/csp-report'), 'report-uri appended')

  process.env.STARFORGE_CSP_MODE = 'off'
  const off = buildSecurityHeaders({ hsts: false })
  assert(!header(off, 'Content-Security-Policy-Report-Only'), 'off mode drops report-only')
  assert(header(off, 'Content-Security-Policy')?.includes("object-src 'none'"), 'off mode keeps floor')
  delete process.env.STARFORGE_CSP_MODE
  delete process.env.STARFORGE_CSP_REPORT_URI

  // Injection: anything that is not a plain source token is dropped.
  const merged = mergeCspSources({
    'script-src': ["https://evil.example; script-src *", "'none' 'unsafe-eval'", 'https://ok.example'],
    // @ts-expect-error unknown directive is ignored
    'require-trusted-types-for': ["'script'"],
  })
  assert(merged['script-src']?.join(' ') === 'https://ok.example', 'unsafe tokens must be dropped')
  assert(!('require-trusted-types-for' in merged), 'unknown directives dropped')

  // Spaces / S3 media origin.
  process.env.STARFORGE_MEDIA_STORAGE = 's3'
  process.env.S3_PUBLIC_BASE_URL = 'https://bucket.nyc3.cdn.digitaloceanspaces.com/'
  assert(
    has(composeCspSources(), 'media-src', 'https://bucket.nyc3.cdn.digitaloceanspaces.com'),
    'S3 public base origin must be in media-src',
  )
  delete process.env.STARFORGE_MEDIA_STORAGE
  delete process.env.S3_PUBLIC_BASE_URL

  // Font Awesome CDN — on, product toggle off, disabled.
  const faOn = collect({
    fontAwesome: { enabled: true, v4Compat: true, contentCompat: false, version: '7-free' },
  })
  assert(has(faOn, 'style-src', 'https://cdnjs.cloudflare.com'), 'FA CDN style-src')
  assert(has(faOn, 'font-src', 'https://cdnjs.cloudflare.com'), 'FA CDN font-src')
  assert(
    !collect(
      { fontAwesome: { enabled: true, v4Compat: false, contentCompat: false, version: '6-free' } },
      { fontAwesomeOn: false },
    )['style-src'],
    'product:font-awesome off → no FA sources',
  )
  assert(!collect({})['style-src'], 'FA disabled → no FA sources')

  // FA Kit via developer-admin HTML override.
  const kit = collect({
    fontAwesome: {
      enabled: true,
      v4Compat: false,
      contentCompat: false,
      version: '6-free',
      jsScriptHtml: '<script src="https://kit.fontawesome.com/abc123.js" crossorigin="anonymous"></script>',
      cssLinkHtml: '',
    },
  })
  assert(has(kit, 'script-src', 'https://kit.fontawesome.com'), 'FA kit script-src')
  assert(has(kit, 'font-src', 'https://ka-f.fontawesome.com'), 'FA kit companion font-src')
  assert(!has(kit, 'style-src', 'https://cdnjs.cloudflare.com'), 'override replaces CDN pack')

  // Page Settings CSS / JS lists + HTML hooks.
  const assets = collect({
    css: [
      { id: 'c1', name: 'fonts', url: 'https://fonts.googleapis.com/css2?family=Inter' },
      { id: 'c2', name: 'local', url: '/custom.css' },
    ],
    javascript: [{ id: 'j1', name: 'widget', url: '//cdn.jsdelivr.net/npm/x@1/x.min.js' }],
    customHeadHtml: `<link rel="stylesheet" href='https://unpkg.com/a.css'>`,
    beforeBodyCloseHtml: '<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe><script>inline()</script>',
  })
  assert(has(assets, 'style-src', 'https://fonts.googleapis.com'), 'CSS list origin → style-src')
  assert(has(assets, 'font-src', 'https://fonts.gstatic.com'), 'Google Fonts companion font-src')
  assert(has(assets, 'script-src', 'https://cdn.jsdelivr.net'), 'protocol-relative JS → https origin')
  assert(has(assets, 'style-src', 'https://unpkg.com'), 'head <link href> → style-src')
  assert(has(assets, 'frame-src', 'https://www.youtube-nocookie.com'), 'hook <iframe src> → frame-src')
  assert(!JSON.stringify(assets).includes('custom.css'), 'relative URLs stay on self')

  // Analytics atom (consent-gated loader builds its URL in JS → csp contribution).
  const gaAtom = {
    id: 'a1',
    type: 'analytics',
    enabled: true,
    config: { measurementId: 'G-TEST123', provider: 'google', consentGate: true },
  }
  const ga = collect({ atoms: [gaAtom] })
  assert(has(ga, 'script-src', 'https://*.googletagmanager.com'), 'GA script-src')
  assert(has(ga, 'connect-src', 'https://*.google-analytics.com'), 'GA connect-src')
  assert(!collect({ atoms: [{ ...gaAtom, enabled: false }] })['script-src'], 'disabled atom → none')
  assert(!collect({ atoms: [gaAtom] }, { atomsOn: false })['script-src'], 'atom module off → none')
  assert(
    !collect({ atoms: [{ ...gaAtom, config: { measurementId: 'G-1', provider: 'generic' } }] })['script-src'],
    'generic provider (meta only) → none',
  )

  // Payload csrf allowlist.
  const local = payloadCsrfOrigins({
    BETTER_AUTH_URL: 'http://localhost:3000',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000/',
  } as NodeJS.ProcessEnv)
  assert(local.includes('http://localhost:3000'), 'csrf trusts app origin')
  assert(local.includes('http://127.0.0.1:3000'), 'csrf trusts loopback twin')
  const prod = payloadCsrfOrigins({
    BETTER_AUTH_URL: 'https://starforge.example',
    STARFORGE_TRUSTED_ORIGINS: 'https://www.starforge.example, not a url',
  } as NodeJS.ProcessEnv)
  assert(
    prod.join(',') === 'https://starforge.example,https://www.starforge.example',
    `csrf prod origins unexpected: ${prod.join(',')}`,
  )
  assert(payloadCsrfOrigins({} as NodeJS.ProcessEnv).length > 0, 'csrf list is never empty')

  // Better Auth → Payload strategy uses the same allowlist when Origin is sent.
  const env = { BETTER_AUTH_URL: 'https://starforge.example' } as NodeJS.ProcessEnv
  const withOrigin = (origin?: string) => new Headers(origin ? { origin } : {})
  assert(!hasUntrustedOrigin(withOrigin('https://starforge.example'), env), 'own origin trusted')
  assert(hasUntrustedOrigin(withOrigin('https://evil.example'), env), 'foreign origin rejected')
  assert(hasUntrustedOrigin(withOrigin('null'), env), 'opaque origin rejected')
  assert(!hasUntrustedOrigin(withOrigin(), env), 'no Origin (navigation) passes')

  console.log('ok — composed CSP, feature sources, Payload csrf origins')
} finally {
  restore()
}
