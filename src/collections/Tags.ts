import type { CollectionConfig } from 'payload'

/**
 * Shared content taxonomy (SF-132) — one Tags collection for pages (and later
 * posts/media filters). Not a Site Settings product toggle; editors use it from
 * Payload when CMS is on. Keep ACL tags (groups) separate — those stay on Nav /
 * layout slots / Page Settings.
 */
export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'updatedAt'],
    description:
      'Shared content tags for pages (and later posts/media). Distinct from viewing ACL group tags.',
    group: 'Content',
  },
  access: {
    // Public may read tags (for future public facets); writes stay CMS-auth.
    read: () => true,
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
        description: 'Stable key for filters (e.g. news, docs).',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Optional editor note — not required for public search.',
      },
    },
  ],
}
