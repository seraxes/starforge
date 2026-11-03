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
  // Old nested path hit Next 16 Turbopack stale build-manifest ENOENT; keep bookmarks working.
  async redirects() {
    return [
      {
        source: '/app/admin/layouts/breakpoints',
        destination: '/app/admin/breakpoints',
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
