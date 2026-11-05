import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getMailerInfo } from '@/core/mail'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listEmailTemplates } from '../store'
import { EMAIL_MODULE_CATEGORIES, isEmailModuleCategory } from '../types'
import { EmailAdminNav } from './email-admin-nav'
import { EmailTemplatesManager } from './email-templates-manager'

export const metadata = {
  title: 'Email templates — Starforge',
  description: 'Email Manager templates with merge fields.',
}

type Search = Promise<{ category?: string }>

/** product:email-manager templates admin. */
export default async function EmailTemplatesPage({
  searchParams,
}: {
  searchParams: Search
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/admin/settings')
  }

  const params = await searchParams
  const rawCat = (params.category ?? 'all').trim() || 'all'
  const category =
    rawCat === 'all' || isEmailModuleCategory(rawCat) ? rawCat : 'all'

  const [templates, mailer] = await Promise.all([
    listEmailTemplates({ moduleCategory: category === 'all' ? undefined : category }),
    getMailerInfo(),
  ])

  const transportLabel = !mailer.enabled
    ? 'disabled'
    : `${mailer.label}${mailer.ready ? '' : ' — not ready'}`

  return (
    <section className="admin-section admin-layouts-full">
      <EmailAdminNav active="templates" />
      <h2>Email templates</h2>
      <p className="lede admin-lede">
        Subject and body with <code>{'{{merge.fields}}'}</code>. Rules pick a template; Mailer
        sends ({transportLabel}). Rules list:{' '}
        <Link href="/admin/email">Email → Rules</Link>.
      </p>

      <EmailTemplatesManager
        category={category}
        categories={[...EMAIL_MODULE_CATEGORIES]}
        mailerEnabled={mailer.enabled}
        mailerLabel={mailer.label}
        templates={templates.map((t) => ({
          id: t.id,
          label: t.label,
          moduleCategory: t.moduleCategory,
          subject: t.subject,
          bodyText: t.bodyText,
          bodyHtml: t.bodyHtml,
          updatedAt: t.updatedAt.toISOString(),
        }))}
      />
    </section>
  )
}
