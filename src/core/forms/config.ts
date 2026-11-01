import type { LayoutSlotConfig } from '@/core/modules/types'

import type { FormFieldDef, FormFieldType, FormParticleConfig } from './types'

const FIELD_TYPES = new Set<FormFieldType>(['text', 'email', 'textarea'])

export function defaultFormFields(): FormFieldDef[] {
  return [
    { name: 'name', label: 'Name', type: 'text', required: true, placeholder: '' },
    { name: 'email', label: 'Email', type: 'email', required: true, placeholder: '' },
    {
      name: 'message',
      label: 'Message',
      type: 'textarea',
      required: true,
      placeholder: '',
    },
  ]
}

export function defaultFormConfig(): FormParticleConfig {
  return {
    heading: 'Contact',
    fields: defaultFormFields(),
    successMessage: 'Thanks — your message was sent.',
    submitLabel: 'Send',
    useSiteCaptchaDefault: true,
  }
}

function asFieldType(value: unknown): FormFieldType {
  return typeof value === 'string' && FIELD_TYPES.has(value as FormFieldType)
    ? (value as FormFieldType)
    : 'text'
}

export function normalizeFormFields(raw: unknown): FormFieldDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultFormFields()

  const fields: FormFieldDef[] = []
  const seen = new Set<string>()

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim().toLowerCase().replace(/\s+/g, '_') : ''
    if (!name || seen.has(name)) continue
    // Reserved / internal names
    if (name === 'website' || name === 'cf-turnstile-response' || name.startsWith('_')) continue
    seen.add(name)
    fields.push({
      name,
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : name,
      type: asFieldType(row.type),
      required: row.required !== false,
      placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
    })
  }

  return fields.length > 0 ? fields : defaultFormFields()
}

export function readFormConfig(config: LayoutSlotConfig | undefined): FormParticleConfig {
  const c = config ?? {}
  return {
    heading: typeof c.heading === 'string' ? c.heading : 'Contact',
    fields: normalizeFormFields(c.fields),
    successMessage:
      typeof c.successMessage === 'string' && c.successMessage.trim()
        ? c.successMessage.trim()
        : 'Thanks — your message was sent.',
    submitLabel:
      typeof c.submitLabel === 'string' && c.submitLabel.trim()
        ? c.submitLabel.trim()
        : 'Send',
    useSiteCaptchaDefault: c.useSiteCaptchaDefault !== false,
  }
}

/** Serialize for layout slot storage. */
export function formConfigToSlotConfig(cfg: FormParticleConfig): LayoutSlotConfig {
  return {
    heading: cfg.heading ?? '',
    fields: normalizeFormFields(cfg.fields),
    successMessage: cfg.successMessage ?? '',
    submitLabel: cfg.submitLabel ?? 'Send',
    useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
  }
}
