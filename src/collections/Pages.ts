import type { CollectionConfig } from 'payload'

import { pagesLexicalEditor } from '../fields/pagesLexical'

/**
 * Editorial pages — drafts/publish + Lexical rich text body.
 * Anonymous visitors may only read published docs (used by `/[slug]`).
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    description:
      'Marketing / brochure pages. Write with Lexical (headings, lists, links, Media images), then Publish so `/[slug]` can show them.',
  },
  versions: {
    drafts: true,
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
      name: 'body',
      type: 'richText',
      editor: pagesLexicalEditor,
      admin: {
        description:
          'Use the toolbar or “/” slash menu for headings, lists, links, and images from Media.',
      },
    },
  ],
}
