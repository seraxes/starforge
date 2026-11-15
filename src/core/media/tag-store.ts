import 'server-only'

import { slugifyCategoryName } from './categories'
import { getTagBySlug, insertTagRow, renameTagRow } from './document-store'

/**
 * Media-tag writes on `sf_media_tags` (phase 2b).
 * Page tags stay on the Payload `tags` collection until `product:pages` (phase 3).
 * Slug stays stable on rename so existing media filters keep working.
 */

async function uniqueTagSlug(base: string): Promise<string> {
  let slug = base
  for (let n = 2; n < 40; n += 1) {
    const found = await getTagBySlug(slug)
    if (!found) return slug
    slug = `${base}-${n}`.slice(0, 64)
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 64)
}

export async function createMediaTag(input: {
  title: string
}): Promise<{ ok: true; id: string } | { error: string }> {
  const title = input.title.trim()
  if (!title) return { error: 'Enter a tag name.' }
  if (title.length > 80) return { error: 'Tag name is too long.' }

  try {
    const slug = await uniqueTagSlug(slugifyCategoryName(title))
    const row = await insertTagRow({ title, slug })
    return { ok: true, id: row.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create tag.' }
  }
}

export async function renameMediaTag(input: {
  id: string
  title: string
}): Promise<{ ok: true } | { error: string }> {
  const id = input.id.trim()
  const title = input.title.trim()
  if (!id) return { error: 'Missing tag id.' }
  if (!title) return { error: 'Enter a tag name.' }
  if (title.length > 80) return { error: 'Tag name is too long.' }

  try {
    const ok = await renameTagRow(id, title)
    if (!ok) return { error: 'Tag not found.' }
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not rename tag.' }
  }
}
