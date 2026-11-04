import { z } from 'zod'

import {
  defaultFormConfig,
  formConfigToSlotConfig,
  parseCustomFormParticleJson,
} from '@/core/forms/config'

export const formParticleConfigSchema = z
  .object({
    source: z.enum(['definition', 'custom']).optional(),
    formId: z.string().optional(),
    heading: z.string().optional(),
    successMessage: z.string().optional(),
    submitLabel: z.string().optional(),
    useSiteCaptchaDefault: z.boolean().optional(),
    fields: z.unknown().optional(),
    fieldsJson: z.string().optional(),
  })
  .superRefine((raw, ctx) => {
    const source = raw.source === 'custom' ? 'custom' : 'definition'
    if (source !== 'custom') return

    let parsedFields: unknown = raw.fields ?? []
    if (typeof raw.fieldsJson === 'string' && raw.fieldsJson.trim()) {
      try {
        parsedFields = JSON.parse(raw.fieldsJson)
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid custom form JSON.', path: ['fieldsJson'] })
        return
      }
    }

    try {
      parseCustomFormParticleJson(
        typeof raw.fieldsJson === 'string' && raw.fieldsJson.trim()
          ? parsedFields
          : Array.isArray(raw.fields)
            ? raw.fields
            : [],
      )
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message:
          error instanceof Error && error.message
            ? error.message
            : 'Invalid custom form JSON.',
        path: ['fields'],
      })
    }
  })
  .transform((raw) => {
    const source = raw.source === 'custom' ? 'custom' : 'definition'
    const formId = typeof raw.formId === 'string' ? raw.formId.trim() : ''

    let customFields: ReturnType<typeof parseCustomFormParticleJson>['fields'] | undefined
    let customHeading: string | undefined
    let customSuccess: string | undefined
    let customSubmit: string | undefined

    if (source === 'custom') {
      let parsedFields: unknown = Array.isArray(raw.fields) ? raw.fields : []
      if (typeof raw.fieldsJson === 'string' && raw.fieldsJson.trim()) {
        parsedFields = JSON.parse(raw.fieldsJson)
      }
      const parsed = parseCustomFormParticleJson(
        typeof raw.fieldsJson === 'string' && raw.fieldsJson.trim()
          ? parsedFields
          : parsedFields,
      )
      customFields = parsed.fields
      customHeading = parsed.heading
      customSuccess = parsed.successMessage
      customSubmit = parsed.submitLabel
    }

    const headingOverride = typeof raw.heading === 'string' ? raw.heading.trim() : ''
    return formConfigToSlotConfig({
      source,
      formId: source === 'definition' ? formId || undefined : undefined,
      heading:
        headingOverride ||
        (source === 'custom' ? customHeading : undefined) ||
        undefined,
      fields: source === 'custom' ? customFields : undefined,
      successMessage:
        (typeof raw.successMessage === 'string' ? raw.successMessage.trim() : '') ||
        (source === 'custom' ? customSuccess : undefined) ||
        undefined,
      submitLabel:
        (typeof raw.submitLabel === 'string' ? raw.submitLabel.trim() : '') ||
        (source === 'custom' ? customSubmit : undefined) ||
        undefined,
      useSiteCaptchaDefault: raw.useSiteCaptchaDefault !== false,
    })
  })

export function formParticleDefaults() {
  return { ...defaultFormConfig() }
}
