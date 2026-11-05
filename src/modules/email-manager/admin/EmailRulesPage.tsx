import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getMailerInfo } from '@/core/mail'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listEmailTriggers } from '../triggers'
import { listEmailRules, listEmailTemplates } from '../store'
import { EMAIL_MODULE_CATEGORIES, isEmailModuleCategory } from '../types'
import { EmailAdminNav } from './email-admin-nav'
import { EmailRulesManager } from './email-rules-manager'

export const metadata = {
  title: 'Email rules — Starforge',
  description: 'Automatic and conditional email rules by module (Email Manager).',
}

type Search = Promise<{ category?: string }>

/** product:email-manager rules admin. */
export default async function EmailRulesPage({ searchParams }: { searchParams: Search }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/app/admin/settings')
  }

  const params = await searchParams
  const rawCat = (params.category ?? 'all').trim() || 'all'
  const category =
    rawCat === 'all' || isEmailModuleCategory(rawCat) ? rawCat : 'all'

  const [rules, templates, mailer] = await Promise.all([
    listEmailRules({ moduleCategory: category === 'all' ? undefined : category }),
    listEmailTemplates(),
    getMailerInfo(),
  ])
  const triggers = listEmailTriggers()

  const transportLabel = !mailer.enabled
    ? 'disabled'
    : `${mailer.label}${mailer.ready ? '' : ' — not ready'}`

  return (
    <section className="admin-section admin-layouts-full">
      <EmailAdminNav active="rules" />
      <h2>Email rules</h2>
      <p className="lede admin-lede">
        Bind automatic or conditional sends to module triggers. Transport is the platform{' '}
        <strong>Mailer</strong> ({transportLabel}
        {mailer.detail ? ` — ${mailer.detail}` : ''}). Configure enable / provider / From under{' '}
        <Link href="/app/admin/site-chrome">Chrome</Link>; secrets stay in env. Module on/off:{' '}
        <Link href="/app/admin/settings">Settings → Modules</Link>. Templates:{' '}
        <Link href="/app/admin/email/templates">Email → Templates</Link>.
      </p>

      <EmailRulesManager
        category={category}
        categories={[...EMAIL_MODULE_CATEGORIES]}
        rules={rules.map((r) => ({
          id: r.id,
          label: r.label,
          moduleCategory: r.moduleCategory,
          enabled: r.enabled,
          triggerKey: r.triggerKey,
          mode: r.mode,
          conditionsJson: JSON.stringify(r.conditions ?? { all: [] }),
          audienceTo: (r.audience.to || []).join(', '),
          audienceToFromPayload: (r.audience.toFromPayload || []).join(', '),
          audienceReplyTo: r.audience.replyTo || '',
          audienceReplyToFromPayload: r.audience.replyToFromPayload || '',
          templateId: r.templateId,
          fromOverride: r.fromOverride,
          updatedAt: r.updatedAt.toISOString(),
        }))}
        templates={templates.map((t) => ({
          id: t.id,
          label: t.label,
          moduleCategory: t.moduleCategory,
        }))}
        triggers={triggers.map((t) => ({
          key: t.key,
          label: t.label,
          moduleCategory: t.moduleCategory,
        }))}
      />
    </section>
  )
}
