import { getPublishedContentCache, contentCacheTags } from './cache'

async function invalidate(tags: readonly string[]): Promise<void> {
  await getPublishedContentCache().invalidateTags(tags)
}

/**
 * Drop cached published page data after Payload publish / unpublish / delete / slug change.
 * Also bumps site-settings when a slug changes (nav page links resolve from slug).
 */
export async function invalidatePublishedPage(options: {
  slug?: string | null
  previousSlug?: string | null
  slugChanged?: boolean
}): Promise<void> {
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

  await invalidate([...tags])
}

/** Drop cached site name / primary nav / feature flags (+ proxy CSP policy). */
export async function invalidateSiteSettings(): Promise<void> {
  await invalidate([contentCacheTags.siteSettings, contentCacheTags.proxyPolicy])
}

/** Drop cached Site Chrome policy document (+ proxy CSP / offline inputs). */
export async function invalidateSiteChrome(): Promise<void> {
  await invalidate([contentCacheTags.siteChrome, contentCacheTags.proxyPolicy])
}

/** Drop cached layout outline(s). */
export async function invalidateLayout(layoutId?: string | null): Promise<void> {
  const tags = new Set<string>([contentCacheTags.layouts])
  const id = typeof layoutId === 'string' ? layoutId.trim() : ''
  if (id) tags.add(contentCacheTags.layout(id))
  await invalidate([...tags])
}

/** Drop cached Nav manager menu(s) and site-settings (primary nav embeds menu items). */
export async function invalidateNavMenu(menuId?: string | null): Promise<void> {
  const tags = new Set<string>([
    contentCacheTags.navMenus,
    contentCacheTags.siteSettings,
    contentCacheTags.proxyPolicy,
  ])
  const id = typeof menuId === 'string' ? menuId.trim() : ''
  if (id) tags.add(contentCacheTags.navMenu(id))
  await invalidate([...tags])
}

/** Drop cached Page Settings chrome (+ proxy CSP sources that scan chrome). */
export async function invalidatePageChrome(rowId?: string | null): Promise<void> {
  const tags = new Set<string>([contentCacheTags.pageChrome, contentCacheTags.proxyPolicy])
  const id = typeof rowId === 'string' ? rowId.trim() : ''
  if (id) tags.add(contentCacheTags.pageChromeRow(id))
  await invalidate([...tags])
}
