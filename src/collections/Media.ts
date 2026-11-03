import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionConfig, Where } from 'payload'

import {
  MEDIA_CARD_WIDTH,
  MEDIA_FOLDERS,
  MEDIA_LARGE_WIDTH,
  MEDIA_MAX_HEIGHT,
  MEDIA_MAX_WIDTH,
  MEDIA_PURPOSES,
  MEDIA_THUMB_SIZE,
  MEDIA_WEBP_QUALITY,
} from '@/core/media/pipeline'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Payload Media — Starforge's single media library (SF-28).
 *
 * Pipeline:
 * - Max W×H resize on original (no enlargement)
 * - WebP derivatives (thumbnail / card / large) at MEDIA_WEBP_QUALITY
 * - PNG originals kept (no top-level formatOptions) — use purpose=logo for logos
 * - folder + purpose for library filtering (categories where practical)
 * - JPEG original re-encode quality: deferred (avoid fighting Payload upload order);
 *   dimension cap + WebP sizes cover the bulk of weight today
 *
 * Privacy: Form respondent attachments use folder=forms + private=true and are
 * not world-readable via REST/list/file routes. Core admins open them via
 * `/api/admin/form-attachments/[id]`.
 *
 * Storage: local `staticDir` by default; Spaces/S3 when STARFORGE_MEDIA_STORAGE=s3
 * (Payload `@payloadcms/storage-s3` plugin — same Media library, no second store).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
    description:
      'Starforge media library. Prefer Core admin → Media for upload/picker; Payload edit for alt/folder. Form attachments (private) stay admin-only.',
    defaultColumns: ['filename', 'alt', 'folder', 'purpose', 'private', 'updatedAt'],
    listSearchableFields: ['alt', 'filename', 'folder'],
  },
  access: {
    // Anonymous: public library only. Form intake (folder=forms / private) requires a CMS user
    // (Payload admin) or Core's admin-gated attachment route (overrideAccess).
    read: ({ req: { user } }) => {
      if (user) return true
      const where: Where = {
        and: [
          { private: { not_equals: true } },
          { folder: { not_equals: 'forms' } },
        ],
      }
      return where
    },
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'folder',
      type: 'select',
      defaultValue: 'general',
      options: MEDIA_FOLDERS.map((f) => ({ label: f.label, value: f.value })),
      admin: {
        description: 'Library category for Core admin filters (not a second media store).',
        position: 'sidebar',
      },
    },
    {
      name: 'purpose',
      type: 'select',
      defaultValue: 'photo',
      options: MEDIA_PURPOSES.map((p) => ({ label: p.label, value: p.value })),
      admin: {
        description:
          'Logo keeps PNG originals in public binds; photos prefer WebP derivatives.',
        position: 'sidebar',
      },
    },
    {
      name: 'private',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'When set (Form respondent uploads), hide from public Media list/API. Serve via Core admin attachment route.',
        position: 'sidebar',
      },
    },
  ],
  upload: {
    staticDir: path.resolve(dirname, '../../media'),
    // Images + common Form attachment types (single library; Form tags folder=forms).
    // Anonymous Form path additionally rejects SVG (see form-upload.ts).
    mimeTypes: [
      'image/*',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    resizeOptions: {
      width: MEDIA_MAX_WIDTH,
      height: MEDIA_MAX_HEIGHT,
      withoutEnlargement: true,
    },
    imageSizes: [
      {
        name: 'thumbnail',
        width: MEDIA_THUMB_SIZE,
        height: MEDIA_THUMB_SIZE,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: MEDIA_WEBP_QUALITY } },
      },
      {
        name: 'card',
        width: MEDIA_CARD_WIDTH,
        height: undefined,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: MEDIA_WEBP_QUALITY } },
      },
      {
        name: 'large',
        width: MEDIA_LARGE_WIDTH,
        height: undefined,
        position: 'centre',
        formatOptions: { format: 'webp', options: { quality: MEDIA_WEBP_QUALITY } },
      },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    crop: true,
  },
}
