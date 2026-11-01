import type { LayoutSlotConfig } from '@/core/modules/types'

import {
  DEFAULT_CONTACT_FORM_ID,
  defaultFormFields,
  normalizeFormFields,
} from './definition'
import type { FormFieldDef, FormParticleConfig } from './types'

export { defaultFormFields, normalizeFormFields }

export function defaultFormConfig(): FormParticleConfig {
  return {
    formId: DEFAULT_CONTACT_FORM_ID,
    heading: 'Contact',
    fields: defaultFormFields(),
    successMessage: 'Thanks — your message was sent.',
    submitLabel: 'Send',
    useSiteCaptchaDefault: true,
  }
}

export function readFormConfig(config: LayoutSlotConfig | undefined): FormParticleConfig {
  const c = config ?? {}
  const formId =
    typeof c.formId === 'string' && c.formId.trim() ? c.formId.trim() : undefined
  const fieldsRaw = c.fields
  const fields = Array.isArray(fieldsRaw) ? normalizeFormFields(fieldsRaw) : undefined

  return {
    formId,
    heading: typeof c.heading === 'string' ? c.heading : undefined,
    fields: fields && fields.length > 0 ? fields : formId ? undefined : defaultFormFields(),
    successMessage:
      typeof c.successMessage === 'string' && c.successMessage.trim()
        ? c.successMessage.trim()
        : undefined,
    submitLabel:
      typeof c.submitLabel === 'string' && c.submitLabel.trim()
        ? c.submitLabel.trim()
        : undefined,
    useSiteCaptchaDefault: c.useSiteCaptchaDefault !== false,
  }
}

/** Serialize for layout slot storage. */
export function formConfigToSlotConfig(cfg: FormParticleConfig): LayoutSlotConfig {
  const out: LayoutSlotConfig = {
    useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
  }
  if (cfg.formId) out.formId = cfg.formId
  if (typeof cfg.heading === 'string') out.heading = cfg.heading
  if (typeof cfg.successMessage === 'string') out.successMessage = cfg.successMessage
  if (typeof cfg.submitLabel === 'string') out.submitLabel = cfg.submitLabel
  if (cfg.fields && cfg.fields.length > 0 && !cfg.formId) {
    out.fields = normalizeFormFields(cfg.fields)
  }
  return out
}

/** Resolve fields for render/submit: definition wins when formId set. */
export function mergeParticleWithDefinition(
  particle: FormParticleConfig,
  definition: {
    title: string
    fields: FormFieldDef[]
    successMessage: string
    submitLabel: string
    useSiteCaptchaDefault: boolean
  } | null,
): {
  heading: string
  fields: FormFieldDef[]
  successMessage: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
  definitionId: string | null
} {
  if (definition) {
    return {
      heading:
        typeof particle.heading === 'string' && particle.heading.trim()
          ? particle.heading.trim()
          : definition.title,
      fields: definition.fields.length > 0 ? definition.fields : defaultFormFields(),
      successMessage: definition.successMessage,
      submitLabel: definition.submitLabel,
      useSiteCaptchaDefault:
        particle.useSiteCaptchaDefault !== undefined
          ? particle.useSiteCaptchaDefault !== false
          : definition.useSiteCaptchaDefault,
      definitionId: particle.formId ?? null,
    }
  }

  return {
    heading:
      typeof particle.heading === 'string' && particle.heading.trim()
        ? particle.heading.trim()
        : 'Contact',
    fields:
      particle.fields && particle.fields.length > 0
        ? particle.fields
        : defaultFormFields(),
    successMessage: particle.successMessage ?? 'Thanks — your message was sent.',
    submitLabel: particle.submitLabel ?? 'Send',
    useSiteCaptchaDefault: particle.useSiteCaptchaDefault !== false,
    definitionId: null,
  }
}
