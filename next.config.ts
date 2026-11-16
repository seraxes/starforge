import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'
import { readFileSync } from 'node:fs'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildSecurityHeaders } from './src/core/security/headers'

const withNextIntl = createNextIntlPlugin('./src/core/i18n/request.ts')

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/** product:pwa — Serwist builds `public/sw.js`; registration is owned by PwaRegister. */
const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  register: false,
})

const nextConfig: NextConfig = {
  // Local / GitHub Packages module packs (TypeScript source consumed via transpile).
  transpilePackages: ['@starforge/module-notice-bar', '@starforge/module-consent'],
  // Avoid auto-writing AGENTS.md into the repo on every `next dev`.
  agentRules: false,
  // Allow opening the app as 127.0.0.1 during local Windows/macOS testing.
  allowedDevOrigins: ['127.0.0.1'],
  // Form file fields default to 10 MiB (FORM_FILE_HARD_MAX_BYTES). Multipart
  // overhead needs headroom above that app-level cap — keep these aligned.
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
  // Route bookmarks: Core `/admin` (was `/app/admin`). Former `/cms` admin redirects here.
  async redirects() {
    return [
      {
        source: '/admin/layouts/breakpoints',
        destination: '/admin/breakpoints',
        permanent: false,
      },
      {
        source: '/app/admin',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/app/admin/:path*',
        destination: '/admin/:path*',
        permanent: false,
      },
      {
        source: '/cms',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/cms/:path*',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/admin/collections/:path*',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/admin/globals/:path*',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/admin/create-first-user',
        destination: '/admin',
        permanent: false,
      },
    ]
  },
  // Baseline security headers (CSP / frame / referrer / …). HSTS only on HTTPS path.
  // Static set without feature CSP sources; middleware re-applies the headers and
  // adds Settings / Page Settings sources on public + app routes.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

/**
 * product:pwa is compiled in only when the active allowlist names it.
 * Dev still disables Serwist inside the init.
 */
function pwaOnActiveAllowlist(): boolean {
  const env = process.env.SF_MODULES
  if (env != null && env.trim()) {
    return env
      .split(',')
      .map((id) => id.trim())
      .includes('product:pwa')
  }
  const file = JSON.parse(
    readFileSync(new URL('./starforge.modules.json', import.meta.url), 'utf8'),
  ) as { flavor?: unknown; presets?: Record<string, unknown>; modules?: unknown }
  const flavor =
    typeof file.flavor === 'string' && file.flavor.trim() ? file.flavor.trim() : 'core'
  const preset = file.presets?.[flavor]
  const ids = Array.isArray(preset)
    ? preset
    : Array.isArray(file.modules)
      ? file.modules
      : []
  return ids.some((id) => id === 'product:pwa')
}

const appConfig = withNextIntl(nextConfig)

export default pwaOnActiveAllowlist() ? withSerwist(appConfig) : appConfig
