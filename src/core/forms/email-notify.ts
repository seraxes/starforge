/**
 * Form email-on-submit — schema + stub transport until platform email exists.
 * Server-only: call from submitFormAction after a successful save.
 */

import 'server-only'

import { getFormsModuleSettings } from './settings-store'
import type { FormDefinitionDocument, FormEmailNotifyConfig } from './types'

export type FormEmailNotifyIntent = {
  to: string[]
  subject: string
  kind: 'admin' | 'respondent'
  body: string
}

export type FormEmailNotifyResult = {
  attempted: boolean
  transport: 'stub'
  intents: FormEmailNotifyIntent[]
  /** Always true for stub — nothing was actually sent. */
  stubbed: true
}

function splitEmails(list: string[] | undefined): string[] {
  if (!list?.length) return []
  return list
    .flatMap((e) => e.split(/[,;\s]+/))
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
}

function formatPayloadBody(payload: Record<string, string>, title: string): string {
  const lines = Object.entries(payload).map(([k, v]) => `${k}: ${v}`)
  return [`Form: ${title}`, '', ...lines].join('\n')
}

/**
 * Build notify intents from per-form config + module defaults.
 * Does not send — stub logs intent for when SMTP/transactional email lands.
 */
export async function planFormEmailNotify(options: {
  document: FormDefinitionDocument
  payload: Record<string, string>
  formKey: string
  definitionId: string | null
}): Promise<FormEmailNotifyResult> {
  const settings = await getFormsModuleSettings()
  const cfg: FormEmailNotifyConfig = options.document.emailNotify ?? {}
  const intents: FormEmailNotifyIntent[] = []
  const title = options.document.title || options.definitionId || options.formKey
  const body = formatPayloadBody(options.payload, title)

  if (cfg.notifyAdmin) {
    const to = splitEmails(cfg.adminEmails?.length ? cfg.adminEmails : settings.defaultAdminEmails)
    if (to.length) {
      intents.push({
        to,
        subject: cfg.adminSubject || `[Starforge Form] ${title}`,
        kind: 'admin',
        body,
      })
    }
  }

  if (cfg.notifyRespondent) {
    const field = cfg.respondentEmailField || 'email'
    const respondent = String(options.payload[field] ?? '')
      .trim()
      .toLowerCase()
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondent)) {
      intents.push({
        to: [respondent],
        subject: cfg.respondentSubject || `We received your ${title} submission`,
        kind: 'respondent',
        body:
          options.document.successMessage ||
          'Thanks — we received your submission.\n\n' + body,
      })
    }
  }

  return {
    attempted: intents.length > 0,
    transport: 'stub',
    intents,
    stubbed: true,
  }
}

/** Stub dispatch — records intent; replace with real transport later. */
export async function dispatchFormEmailNotify(
  plan: FormEmailNotifyResult,
): Promise<FormEmailNotifyResult> {
  if (plan.intents.length && process.env.NODE_ENV !== 'production') {
    console.info(
      '[forms:email-stub]',
      JSON.stringify({
        transport: plan.transport,
        count: plan.intents.length,
        to: plan.intents.map((i) => ({ kind: i.kind, to: i.to, subject: i.subject })),
      }),
    )
  }
  return plan
}

