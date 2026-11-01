/**
 * Forms module settings helpers (client-safe).
 */

import type { FormsModuleSettings } from './types'

export function defaultFormsModuleSettings(): FormsModuleSettings {
  return {
    version: 1,
    defaultAdminEmails: [],
    fromAddress: '',
    transport: 'stub',
    defaultSuccessMessage: 'Thanks — your message was sent.',
  }
}

export function normalizeFormsModuleSettings(raw: unknown): FormsModuleSettings {
  const base = defaultFormsModuleSettings()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base
  const row = raw as Record<string, unknown>
  const emails = Array.isArray(row.defaultAdminEmails)
    ? row.defaultAdminEmails
        .map((e) => (typeof e === 'string' ? e.trim() : ''))
        .filter(Boolean)
    : typeof row.defaultAdminEmails === 'string'
      ? row.defaultAdminEmails
          .split(/[,;\s]+/)
          .map((e) => e.trim())
          .filter(Boolean)
      : base.defaultAdminEmails
  return {
    version: 1,
    defaultAdminEmails: emails,
    fromAddress:
      typeof row.fromAddress === 'string' ? row.fromAddress.trim() : base.fromAddress,
    transport: 'stub',
    defaultSuccessMessage:
      typeof row.defaultSuccessMessage === 'string' && row.defaultSuccessMessage.trim()
        ? row.defaultSuccessMessage.trim()
        : base.defaultSuccessMessage,
  }
}
