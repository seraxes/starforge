import { getPublishedContentCache, contentCacheTags } from './cache'

/**
 * Drop cached published page data after Payload publish / unpublish / delete / slug change.
 * Also bumps site-settings when a slug changes (nav page links resolve from slug).
 */
export function invalidatePublishedPage(options: {
  slug?: string | null
  previousSlug?: string | null
  slugChanged?: boolean
}): void {
  const tags = new Set<string>([contentCacheTags.pages])

  if (options.slug) {
    tags.add(contentCacheTags.page(options.slug))
  }
  if (options.previousSlug && options.previousSlug !== options.slug) {
    tags.add(contentCacheTags.page(options.previousSlug))
  }
  if (options.slugChanged || (options.previousSlug && options.previousSlug !== options.slug)) {
    tags.add(contentCacheTags.siteSettings)
  }

  getPublishedContentCache().invalidateTags([...tags])
}

/** Drop cached site name / primary nav / feature flags. */
export function invalidateSiteSettings(): void {
  getPublishedContentCache().invalidateTags([contentCacheTags.siteSettings])
}
