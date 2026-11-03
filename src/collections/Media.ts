import path from 'path'
import { fileURLToPath } from 'url'
import type { CollectionBeforeChangeHook, CollectionConfig, Where } from 'payload'

import {
  STARFORGE_PIPELINE_APPLIED,
  applyMediaPipelineRules,
} from '@/core/media/apply-pipeline'
import {
  MEDIA_CARD_WIDTH,
  MEDIA_FOLDERS,
  MEDIA_LARGE_WIDTH,
  MEDIA_PIPELINE_MAX_EDGE_MAX,
  MEDIA_PURPOSES,
  MEDIA_THUMB_SIZE,
  MEDIA_WEBP_QUALITY,
  normalizeMediaPurpose,
} from '@/core/media/pipeline'
import { getMediaPipelineRules } from '@/core/media/settings-store'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Apply the same sharp rules when uploads bypass Core UI (Payload admin / Lexical).
 * Core `uploadMediaAction` sets context.starforgePipelineApplied to skip a second pass.
 */
const applyPipelineBeforeChange: CollectionBeforeChangeHook = async ({ data, req }) => {
  const already =
    req.context &&
    typeof req.context === 'object' &&
    (req.context as Record<string, unknown>)[STARFORGE_PIPELINE_APPLIED] === true
  if (already) return data

  const file = req.file
  if (!file?.data || !Buffer.isBuffer(file.data)) return data

  const mime = (file.mimetype || '').toLowerCase()
  if (!mime.startsWith('image/')) return data

  const purpose = normalizeMediaPurpose(data?.purpose)
  const rules = await getMediaPipelineRules()
  const processed = await applyMediaPipelineRules({
    buffer: file.data,
    mimeType: file.mimetype || 'application/octet-stream',
    purpose,
    rules,
  })

  file.data = processed.data
  file.mimetype = processed.mimetype
  file.size = processed.data.length
  if (processed.extHint && typeof file.name === 'string' && file.name) {
    file.name = file.name.replace(/\.[^.]+$/, '') + `.${processed.extHint}`
  }

  return data
}

/**
 * Payload Media — Starforge's single media library (SF-28 / SF-148).
 *
 * Pipeline:
 * - Max W×H resize on original (no enlargement)
 * - WebP derivatives (thumbnail / card / large) at MEDIA_WEBP_QUALITY
 * - PNG originals kept (no top-level formatOptions) — use purpose=logo for logos
 * - category (nested) + legacy folder + purpose + shared Tags for library filtering
 * - Core preprocess + this beforeChange share applyMediaPipelineRules
 *
 * Privacy: Form respondent attachments use folder=forms + private=true and are
 * not world-readable via REST/list/file routes. Core admins open them via
 * `/api/admin/form-attachments/[id]`. Nested Categories browse lives in Core Media;
 * `folder` stays for Form privacy + migration until fully deprecated.
 *
 * Storage: local `staticDir` by default; Spaces/S3 when STARFORGE_MEDIA_STORAGE=s3
 * (Payload `@payloadcms/storage-s3` plugin — same Media library, no second store).
 * Incomplete s3 env throws (no silent local fallback).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Content',
    description:
      'Starforge media library. Prefer Core admin → Media for upload/picker; Payload edit for alt/category/tags. Form attachments (private) stay admin-only.',
    defaultColumns: ['filename', 'alt', 'category', 'folder', 'purpose', 'tags', 'private', 'updatedAt'],
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
  hooks: {
    beforeChange: [applyPipelineBeforeChange],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      admin: {
        position: 'sidebar',
        description:
          'Primary nested folder (Media Manager tree). Prefer Core library for browse/CRUD.',
      },
    },
    {
      name: 'folder',
      type: 'select',
      defaultValue: 'general',
      options: MEDIA_FOLDERS.map((f) => ({ label: f.label, value: f.value })),
      admin: {
        description:
          'Legacy flat bucket — kept for Form privacy (forms) and migration. Prefer category.',
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
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description:
          'Shared content tags (SF-132 taxonomy). Same Tags as Pages — filter in Core Media library.',
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
    // Ceiling only — Core Media Settings + beforeChange own the real max W×H.
    resizeOptions: {
      width: MEDIA_PIPELINE_MAX_EDGE_MAX,
      height: MEDIA_PIPELINE_MAX_EDGE_MAX,
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
