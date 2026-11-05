/**
 * Built-in Email Manager trigger registry.
 * Modules emit these keys; admin binds rules. Auth Mailer paths stay direct until ready.
 */

import type { EmailTriggerDef } from './types'

export const BUILTIN_EMAIL_TRIGGERS: readonly EmailTriggerDef[] = [
  {
    key: 'product:forms/submitted',
    label: 'Form submitted',
    moduleCategory: 'forms',
    moduleId: 'product:forms',
    description:
      'Fired after a successful Form definition submit (alongside legacy per-form notify).',
    payloadFields: [
      'formKey',
      'definitionId',
      'formTitle',
      'preset',
      'payload',
      'payloadText',
      'notifyAdmin',
      'notifyRespondent',
      'adminEmails',
      'respondentEmail',
      'submissionId',
    ],
  },
  {
    key: 'product:forms/test',
    label: 'Form test notify',
    moduleCategory: 'forms',
    moduleId: 'product:forms',
    description: 'Admin test send from Forms settings / Email Manager.',
    payloadFields: ['formTitle', 'payloadText', 'adminEmails', 'respondentEmail'],
  },
  {
    key: 'platform:auth/password-reset',
    label: 'Password reset (registered)',
    moduleCategory: 'auth',
    moduleId: 'platform:better-auth',
    description:
      'Registered for future rule binding — Auth still sends via Core Mailer helpers in v1.',
    payloadFields: ['email', 'url', 'userName'],
  },
  {
    key: 'platform:auth/magic-link',
    label: 'Magic link (registered)',
    moduleCategory: 'auth',
    moduleId: 'platform:better-auth',
    description: 'Registered for future rule binding — Auth Mailer path unchanged in v1.',
    payloadFields: ['email', 'url'],
  },
  {
    key: 'system:test',
    label: 'Email Manager test send',
    moduleCategory: 'system',
    moduleId: 'product:email-manager',
    description: 'Admin test send from Email Manager (does not require a rule).',
    payloadFields: ['to', 'subject', 'body', 'note'],
  },
] as const

const BY_KEY = new Map(BUILTIN_EMAIL_TRIGGERS.map((t) => [t.key, t]))

export function getEmailTrigger(key: string): EmailTriggerDef | undefined {
  return BY_KEY.get(key.trim())
}

export function listEmailTriggers(filter?: {
  moduleCategory?: string
}): EmailTriggerDef[] {
  const cat = filter?.moduleCategory?.trim()
  if (!cat || cat === 'all') return [...BUILTIN_EMAIL_TRIGGERS]
  return BUILTIN_EMAIL_TRIGGERS.filter((t) => t.moduleCategory === cat)
}

export function isKnownEmailTriggerKey(key: string): boolean {
  return BY_KEY.has(key.trim())
}
