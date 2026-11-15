import { getPayload } from 'payload'

import config from '@payload-config'

import { slugifyCategoryName } from './categories'

/**
 * Shared Payload `tags` writes for the Media library (phase 2a).
 * Page tags still use this collection until `product:pages` (phase 3).
 * Slug stays stable on rename so existing media filters keep working.
 */

async function uniqueTagSlug(
  payload: Awaited<ReturnType<typeof getPayload>>,
  base: string,
): Promise<string> {
  let slug = base
  for (let n = 2; n < 40; n += 1) {
    const found = await payload.find({
      collection: 'tags',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!found.docs.length) return slug
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
    const payload = await getPayload({ config })
    const slug = await uniqueTagSlug(payload, slugifyCategoryName(title))
    const doc = await payload.create({
      collection: 'tags',
      data: { title, slug },
      overrideAccess: true,
    })
    return { ok: true, id: String(doc.id) }
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
    const payload = await getPayload({ config })
    await payload.update({
      collection: 'tags',
      id,
      data: { title },
      overrideAccess: true,
    })
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not rename tag.' }
  }
}
