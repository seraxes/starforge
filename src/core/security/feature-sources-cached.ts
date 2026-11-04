import 'server-only'

import { contentCacheTags, getPublishedContentCache } from '@/core/content/cache'

import { resolveFeatureCspSources } from './feature-sources'
import type { CspSources } from './csp'

/**
 * Feature CSP sources for the Node proxy / public responses.
 * Cached under `proxyPolicy` (+ chrome / settings / page-chrome tags) so
 * every public request does not re-scan Site Chrome + Page Settings.
 */
export async function getCachedFeatureCspSources(): Promise<CspSources> {
  return getPublishedContentCache().getCached(
    {
      key: ['sf', 'proxy-policy', 'csp-sources'],
      tags: [
        contentCacheTags.proxyPolicy,
        contentCacheTags.siteChrome,
        contentCacheTags.siteSettings,
        contentCacheTags.pageChrome,
      ],
      revalidate: false,
    },
    resolveFeatureCspSources,
  )
}
