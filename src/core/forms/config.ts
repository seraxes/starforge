import type { LayoutSlotConfig } from '@/core/modules/types'

import {
  DEFAULT_CONTACT_FORM_ID,
  defaultFormFields,
  normalizeFormFields,
} from './definition'
import { isFormFieldType, SF_FIELD_TYPE_KEY } from './schema-json'
import type {
  FormFieldDef,
  FormFieldType,
  FormParticleConfig,
  FormParticleSource,
} from './types'

export { defaultFormFields, normalizeFormFields }

export function defaultFormConfig(): FormParticleConfig {
  return {
    source: 'definition',
    formId: DEFAULT_CONTACT_FORM_ID,
    heading: 'Contact',
    successMessage: 'Thanks — your message was sent.',
    submitLabel: 'Send',
    useSiteCaptchaDefault: true,
  }
}

/** Infer source from stored slot config (older layouts omit `source`). */
export function resolveFormParticleSource(
  config: Pick<FormParticleConfig, 'source' | 'formId' | 'fields'>,
): FormParticleSource {
  if (config.source === 'custom' || config.source === 'definition') return config.source
  if (config.formId) return 'definition'
  if (config.fields && config.fields.length > 0) return 'custom'
  return 'definition'
}

/**
 * Parse pasted custom JSON for the Form particle.
 * Accepts: fields array, definition-shaped `{ fields, … }`, or JSON Schema object.
 */
export function parseCustomFormParticleJson(raw: unknown): {
  fields: FormFieldDef[]
  heading?: string
  successMessage?: string
  submitLabel?: string
} {
  if (Array.isArray(raw)) {
    const fields = normalizeFormFields(raw)
    if (!fields.length) throw new Error('Fields JSON must include at least one field.')
    return { fields }
  }

  if (!raw || typeof raw !== 'object') {
    throw new Error('Custom JSON must be a fields array, form definition, or JSON Schema object.')
  }

  const obj = raw as Record<string, unknown>

  if (Array.isArray(obj.fields)) {
    const fields = normalizeFormFields(obj.fields)
    if (!fields.length) throw new Error('Definition JSON must include at least one field.')
    return {
      fields,
      heading:
        typeof obj.title === 'string' && obj.title.trim()
          ? obj.title.trim()
          : typeof obj.heading === 'string' && obj.heading.trim()
            ? obj.heading.trim()
            : undefined,
      successMessage:
        typeof obj.successMessage === 'string' && obj.successMessage.trim()
          ? obj.successMessage.trim()
          : undefined,
      submitLabel:
        typeof obj.submitLabel === 'string' && obj.submitLabel.trim()
          ? obj.submitLabel.trim()
          : undefined,
    }
  }

  if (obj.type === 'object' && obj.properties && typeof obj.properties === 'object') {
    const fields = fieldsFromJsonSchemaProperties(
      obj.properties as Record<string, unknown>,
      Array.isArray(obj.required)
        ? obj.required.filter((x): x is string => typeof x === 'string')
        : [],
    )
    if (!fields.length) throw new Error('JSON Schema has no usable properties.')
    return {
      fields,
      heading:
        typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : undefined,
    }
  }

  throw new Error('Custom JSON must be a fields array, form definition, or JSON Schema object.')
}

function fieldsFromJsonSchemaProperties(
  properties: Record<string, unknown>,
  requiredNames: string[],
): FormFieldDef[] {
  const required = new Set(requiredNames)
  const draft: Array<Record<string, unknown>> = []

  for (const [name, value] of Object.entries(properties)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const prop = value as Record<string, unknown>
    const extType = prop[SF_FIELD_TYPE_KEY]
    let type: FormFieldType = isFormFieldType(extType) ? extType : 'text'
    if (!isFormFieldType(extType)) {
      if (prop.format === 'email') type = 'email'
      else if (prop.format === 'uri' || prop.format === 'url') type = 'url'
      else if (prop.format === 'date') type = 'date'
      else if (prop.format === 'time') type = 'time'
      else if (prop.format === 'date-time') type = 'datetime'
      else if (prop.type === 'number' || prop.type === 'integer') type = 'number'
      else if (prop.type === 'boolean') type = 'checkbox'
      else if (Array.isArray(prop.enum)) type = 'select'
      else if (prop.type === 'string' && prop.maxLength && Number(prop.maxLength) > 200) {
        type = 'textarea'
      }
    }

    const options = Array.isArray(prop.enum)
      ? prop.enum
          .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
          .map((v) => ({ value: String(v), label: String(v) }))
      : undefined

    draft.push({
      name,
      label: typeof prop.title === 'string' && prop.title.trim() ? prop.title.trim() : name,
      type,
      required: required.has(name),
      description: typeof prop.description === 'string' ? prop.description : undefined,
      defaultValue:
        typeof prop.default === 'string'
          ? prop.default
          : typeof prop['x-sf-defaultValue'] === 'string'
            ? prop['x-sf-defaultValue']
            : undefined,
      ...(options ? { options } : {}),
    })
  }

  return normalizeFormFields(draft)
}

export function readFormConfig(config: LayoutSlotConfig | undefined): FormParticleConfig {
  const c = config ?? {}
  const formId =
    typeof c.formId === 'string' && c.formId.trim() ? c.formId.trim() : undefined
  const fieldsRaw = c.fields
  const fields = Array.isArray(fieldsRaw) ? normalizeFormFields(fieldsRaw) : undefined
  const explicitSource =
    c.source === 'custom' || c.source === 'definition'
      ? (c.source as FormParticleSource)
      : undefined

  const source = resolveFormParticleSource({
    source: explicitSource,
    formId,
    fields,
  })

  return {
    source,
    formId: source === 'definition' ? formId ?? DEFAULT_CONTACT_FORM_ID : undefined,
    heading: typeof c.heading === 'string' ? c.heading : undefined,
    fields:
      source === 'custom'
        ? fields && fields.length > 0
          ? fields
          : defaultFormFields()
        : fields && fields.length > 0
          ? fields
          : undefined,
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
  const source = resolveFormParticleSource(cfg)
  const out: LayoutSlotConfig = {
    source,
    useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
  }
  if (typeof cfg.heading === 'string') out.heading = cfg.heading

  if (source === 'definition') {
    out.formId = (cfg.formId && cfg.formId.trim()) || DEFAULT_CONTACT_FORM_ID
    return out
  }

  if (typeof cfg.successMessage === 'string') out.successMessage = cfg.successMessage
  if (typeof cfg.submitLabel === 'string') out.submitLabel = cfg.submitLabel
  out.fields = normalizeFormFields(
    cfg.fields && cfg.fields.length > 0 ? cfg.fields : defaultFormFields(),
  )
  return out
}

/** Resolve fields for render/submit: definition wins when source=definition + formId. */
export function mergeParticleWithDefinition(
  particle: FormParticleConfig,
  definition: {
    title: string
    fields: FormFieldDef[]
    sections?: import('./types').FormSectionDef[]
    successMessage: string
    successRedirectUrl?: string
    submitLabel: string
    useSiteCaptchaDefault: boolean
  } | null,
): {
  heading: string
  fields: FormFieldDef[]
  sections?: import('./types').FormSectionDef[]
  successMessage: string
  successRedirectUrl?: string
  submitLabel: string
  useSiteCaptchaDefault: boolean
  definitionId: string | null
} {
  const source = resolveFormParticleSource(particle)
  if (source === 'definition' && definition) {
    return {
      heading:
        typeof particle.heading === 'string' && particle.heading.trim()
          ? particle.heading.trim()
          : definition.title,
      fields: definition.fields.length > 0 ? definition.fields : defaultFormFields(),
      sections: definition.sections,
      successMessage: definition.successMessage,
      successRedirectUrl: definition.successRedirectUrl,
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
