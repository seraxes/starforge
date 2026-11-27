import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { isRichEditorEnabled } from '@/modules/rich-editor/api.server'

import { isEmailTemplateEmbedMode } from '../embed-mode'
import { findEmailTemplateById } from '../store'
import { EMAIL_MODULE_CATEGORIES } from '../types'
import { EmailAdminNav } from './email-admin-nav'
import { EmailTemplateEditor } from './email-template-editor'

export const metadata = {
  title: 'Edit email template — Starforge',
  description: 'Full-page Email Manager template editor.',
}

type Params = Promise<{ templateId: string }>
type Search = Promise<{ embed?: string | string[] }>

/** product:email-manager — dedicated template editor. */
export default async function EmailTemplateEditPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams?: Search
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/admin/settings')
  }

  const { templateId } = await params
  const id = (templateId || '').trim()
  if (!id) notFound()

  const search = searchParams ? await searchParams : {}
  const embedRaw = Array.isArray(search.embed) ? search.embed[0] : search.embed
  const embed = isEmailTemplateEmbedMode(embedRaw)

  const template = await findEmailTemplateById(id)
  if (!template) notFound()

  return (
    <section className="admin-section admin-layouts-full">
      {embed ? null : <EmailAdminNav active="templates" />}
      {embed ? null : (
        <p className="sf-events-editor-back">
          <Link href="/admin/email/templates">← Email templates</Link>
        </p>
      )}
      <h2>{template.label}</h2>
      {embed ? null : (
        <p className="lede admin-lede">
          Full-page subject and body editor. Label and module category open under Details.
          Merge fields use <code>{'{{name}}'}</code>.
        </p>
      )}

      <EmailTemplateEditor
        categories={[...EMAIL_MODULE_CATEGORIES]}
        richEditorEnabled={isRichEditorEnabled(settings)}
        embed={embed}
        template={{
          id: template.id,
          label: template.label,
          moduleCategory: template.moduleCategory,
          subject: template.subject,
          bodyText: template.bodyText,
          bodyHtml: template.bodyHtml,
          updatedAt: template.updatedAt.toISOString(),
        }}
      />
    </section>
  )
}
