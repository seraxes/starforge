import React from 'react'

import { pageBodyToHtml } from '@/core/content/lexical-to-html'
import { rootPageSlug } from '@/core/nav/root'
import { RichContent } from '@/generated/module-rich-host'

/**
 * Public page body. TipTap HTML is the stored form.
 * A leftover Lexical JSON document is converted here so the public page
 * does not import Payload or `@payloadcms/richtext-lexical`.
 */
export async function RichText({ data }: { data: unknown }) {
  const html = pageBodyToHtml(data, { rootPageSlug: await rootPageSlug() })
  if (!html) return null
  return <RichContent html={html} className="cms-richtext" />
}
