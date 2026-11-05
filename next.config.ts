import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

import { buildSecurityHeaders } from './src/core/security/headers'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
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
  // Route migration bookmarks: Core `/admin` (was `/app/admin`); Payload `/cms/admin` (was `/admin`).
  async redirects() {
    return [
      {
        source: '/admin/layouts/breakpoints',
        destination: '/admin/breakpoints',
        permanent: false,
      },
      // Legacy Core admin prefix
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
      // Legacy Payload deep links that used to live under /admin
      {
        source: '/admin/collections/:path*',
        destination: '/cms/admin/collections/:path*',
        permanent: false,
      },
      {
        source: '/admin/globals/:path*',
        destination: '/cms/admin/globals/:path*',
        permanent: false,
      },
      {
        source: '/admin/login',
        destination: '/cms/admin/login',
        permanent: false,
      },
      {
        source: '/admin/create-first-user',
        destination: '/cms/admin/create-first-user',
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

export default withPayload(nextConfig, { devBundleServerPackages: false })
