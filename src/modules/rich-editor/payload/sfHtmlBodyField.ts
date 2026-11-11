import type { Field } from 'payload'

import { sanitizeRichHtml } from '../sanitize'
// Direct import: this file is loaded by the Pages collection config.
// `api.server` also loads Site Settings, which loads the Payload config.

/**
 * Localized HTML body field for Payload Pages (TipTap via SfHtmlField).
 * Replaces Lexical richText — stores sanitized HTML string.
 */
export function sfHtmlBodyField(): Field {
  return {
    name: 'body',
    type: 'textarea',
    localized: true,
    admin: {
      description:
        'TipTap rich editor (Visual + HTML). Media library images/video work with local disk or S3/Spaces. Switch CMS locale to edit each language.',
      components: {
        Field: '@/modules/rich-editor/payload/SfHtmlField#SfHtmlField',
      },
    },
    hooks: {
      beforeValidate: [
        ({ value }: { value?: unknown }) => {
          if (typeof value === 'string') return sanitizeRichHtml(value)
          return value
        },
      ],
    },
  }
}
