import { evaluateAndValidateFields } from './evaluate'
import type { FormFieldDef } from './types'

/**
 * Validate FormData-derived string map using the shared evaluate path
 * (visibility, required, date/time, math, computed).
 */
export function validateFieldsWithZod(
  fields: FormFieldDef[],
  values: Record<string, string>,
): { values: Record<string, string>; error?: string } {
  if (fields.length === 0) return { values: {} }
  const result = evaluateAndValidateFields(fields, values)
  return { values: result.values, error: result.error }
}

/** @deprecated Prefer validateFieldsWithZod — kept for callers expecting a Zod object. */
export function fieldsToZodSchema(_fields: FormFieldDef[]) {
  // Runtime validation goes through evaluateAndValidateFields; this stub exists
  // so imports of fieldsToZodSchema do not break. Callers should use validateFieldsWithZod.
  throw new Error('Use validateFieldsWithZod / evaluateAndValidateFields instead of fieldsToZodSchema.')
}
