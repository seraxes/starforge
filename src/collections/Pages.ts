import type { CollectionAfterChangeHook, CollectionAfterDeleteHook, CollectionConfig } from 'payload'

import { pagesLexicalEditor } from '../fields/pagesLexical'
import { invalidatePublishedPage } from '../core/content/revalidate'

const revalidatePageAfterChange: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  const slug = typeof doc?.slug === 'string' ? doc.slug : null
  const previousSlug = typeof previousDoc?.slug === 'string' ? previousDoc.slug : null
  invalidatePublishedPage({ slug, previousSlug })
  return doc
}

const revalidatePageAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  const slug = typeof doc?.slug === 'string' ? doc.slug : null
  invalidatePublishedPage({ slug })
  return doc
}

/**
 * Editorial pages — drafts/publish + Lexical rich text body + SEO meta.
 * Anonymous visitors may only read published docs (used by `/[slug]`).
 * Publish / unpublish / delete invalidates the published-content cache tags.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    description:
      'Marketing / brochure pages for the public site. Edit content here in Payload (/admin). App accounts use /login — not this collection. Publish so `/[slug]` can show the page. With Draft preview on, CMS-access users can open `/preview/{slug}` before publishing. Saving/publishing refreshes the public cached page.',
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
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'Public URL path, e.g. about → http://localhost:3000/about',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'body',
              type: 'richText',
              editor: pagesLexicalEditor,
              admin: {
                description:
                  'Use the toolbar or “/” slash menu for headings, lists, links, and images from Media.',
              },
            },
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
                  label: 'Meta title',
                  admin: {
                    description:
                      'Browser tab / search title. Falls back to the page title + “— Starforge” when empty.',
                  },
                },
                {
                  name: 'description',
                  type: 'textarea',
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
                    description: 'Optional share image (Open Graph / social preview).',
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
