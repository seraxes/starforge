import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from 'payload'

import { invalidatePublishedPage } from '../core/content/revalidate'
import { sfHtmlBodyField } from '../modules/rich-editor/payload/sfHtmlBodyField'

const revalidatePageAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  const slug = typeof doc?.slug === 'string' ? doc.slug : null
  const previousSlug = typeof previousDoc?.slug === 'string' ? previousDoc.slug : null
  await invalidatePublishedPage({ slug, previousSlug })
  return doc
}

const revalidatePageAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  const slug = typeof doc?.slug === 'string' ? doc.slug : null
  await invalidatePublishedPage({ slug })
  return doc
}

/**
 * Editorial pages — drafts/publish + TipTap HTML body + SEO meta.
 * Anonymous visitors may only read published docs (used by `/[slug]`).
 * Publish / unpublish / delete invalidates the published-content cache tags.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    description:
      'Marketing / brochure pages for the public site. Edit content here in Payload (/cms). Title, body, and SEO meta are localized (EN/HU); slug is shared. Publish so `/{locale}/[slug]` can show the page; slug `home` is `/{locale}`. With Draft preview on, CMS-access users can open `/{locale}/preview/{slug}` before publishing. Saving/publishing refreshes the public cached page for all locales.',
  },
  versions: {
    drafts: true,
  },
  hooks: {
    afterChange: [revalidatePageAfterChange],
    afterDelete: [revalidatePageAfterDelete],
  },
  access: {
    read: ({ req: { user } }) => {
      // CMS editors see drafts + published; public site only sees published.
      if (user) {
        return true
      }

      return {
        _status: {
          equals: 'published',
        },
      }
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      // Localized (P1) — one slug shared across locales.
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Shared across locales (v1). Public path under /{locale}/…, e.g. about → /en/about; home → /en (site root).',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description:
          'Shared content tags (SF-132 taxonomy). Optional — filterable later; distinct from ACL viewing groups.',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            sfHtmlBodyField(),
          ],
        },
        {
          label: 'SEO',
          description: 'Used in the public page `<head>` / Open Graph when the page is published.',
          fields: [
            {
              name: 'meta',
              type: 'group',
              label: false,
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  localized: true,
                  label: 'Meta title',
                  admin: {
                    description:
                      'Browser tab / search title. Falls back to the page title + “— Starforge” when empty.',
                  },
                },
                {
                  name: 'description',
                  type: 'textarea',
                  localized: true,
                  label: 'Meta description',
                  admin: {
                    description: 'Short summary for search results and link previews.',
                  },
                },
                {
                  name: 'image',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'OG image',
                  admin: {
                    description: 'Optional share image (Open Graph / social preview). Shared across locales.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
