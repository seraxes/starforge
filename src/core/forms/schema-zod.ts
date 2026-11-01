import { z } from 'zod'

import type { FormFieldDef } from './types'

/**
 * Build a Zod object schema from canonical fields for submit validation.
 * Values arrive as strings from FormData (checkbox → "on" / "").
 */
export function fieldsToZodSchema(fields: FormFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  for (const field of fields) {
    if (!field.name) continue
    const label = field.label || field.name

    switch (field.type) {
      case 'email': {
        let s = z.string()
        if (field.required !== false) {
          s = s.min(1, `${label} is required.`)
          shape[field.name] = s.email(`Enter a valid ${label.toLowerCase()}.`)
        } else {
          shape[field.name] = z.union([
            z.literal(''),
            z.string().email(`Enter a valid ${label.toLowerCase()}.`),
          ])
        }
        break
      }
      case 'number': {
        const base = z.string().refine(
          (v) => v === '' || !Number.isNaN(Number(v)),
          `Enter a valid number for ${label.toLowerCase()}.`,
        )
        shape[field.name] =
          field.required !== false
            ? base.refine((v) => v.trim() !== '', `${label} is required.`)
            : base
        break
      }
      case 'url': {
        if (field.required !== false) {
          shape[field.name] = z
            .string()
            .min(1, `${label} is required.`)
            .url(`Enter a valid URL for ${label.toLowerCase()}.`)
        } else {
          shape[field.name] = z.union([
            z.literal(''),
            z.string().url(`Enter a valid URL for ${label.toLowerCase()}.`),
          ])
        }
        break
      }
      case 'checkbox': {
        // FormData checkbox: present → "on", absent → we pass "".
        const boolish = z.string()
        shape[field.name] = field.required
          ? boolish.refine((v) => v === 'on' || v === 'true' || v === '1', `${label} is required.`)
          : boolish
        break
      }
      case 'select': {
        const allowed = (field.options ?? []).map((o) => o.value).filter(Boolean)
        let s = z.string()
        if (field.required !== false) {
          s = s.min(1, `${label} is required.`)
        }
        if (allowed.length) {
          shape[field.name] = s.refine(
            (v) => v === '' || allowed.includes(v),
            `Choose a valid ${label.toLowerCase()}.`,
          )
        } else {
          shape[field.name] = s
        }
        break
      }
      case 'tel':
      case 'textarea':
      case 'text':
      default: {
        let s = z.string()
        if (field.required !== false) {
          s = s.min(1, `${label} is required.`)
        }
        shape[field.name] = s
        break
      }
    }
  }

  return z.object(shape)
}

export type FormValuesFromZod = Record<string, string>

/** Validate FormData-derived string map; returns values or first error message. */
export function validateFieldsWithZod(
  fields: FormFieldDef[],
  values: Record<string, string>,
): { values: Record<string, string>; error?: string } {
  if (fields.length === 0) return { values: {} }

  const schema = fieldsToZodSchema(fields)
  const result = schema.safeParse(values)
  if (!result.success) {
    const first = result.error.issues[0]
    return {
      values,
      error: first?.message ?? 'Invalid form values.',
    }
  }

  const out: Record<string, string> = {}
  for (const field of fields) {
    const raw = result.data[field.name]
    if (field.type === 'checkbox') {
      out[field.name] = raw === 'on' || raw === 'true' || raw === '1' ? 'true' : 'false'
    } else {
      out[field.name] = typeof raw === 'string' ? raw.trim() : String(raw ?? '')
    }
  }
  return { values: out }
}
