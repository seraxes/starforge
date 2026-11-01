import type { FormFieldDef, FormFieldType, FormJsonSchema } from './types'

const FIELD_TYPES = new Set<FormFieldType>([
  'text',
  'email',
  'textarea',
  'number',
  'tel',
  'url',
  'select',
  'checkbox',
])

export function isFormFieldType(value: unknown): value is FormFieldType {
  return typeof value === 'string' && FIELD_TYPES.has(value as FormFieldType)
}

function propertyForField(field: FormFieldDef): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: field.label,
  }
  if (field.description) base.description = field.description

  switch (field.type) {
    case 'email':
      return { ...base, type: 'string', format: 'email' }
    case 'number':
      return { ...base, type: 'number' }
    case 'checkbox':
      return { ...base, type: 'boolean' }
    case 'url':
      return { ...base, type: 'string', format: 'uri' }
    case 'tel':
      return { ...base, type: 'string' }
    case 'select': {
      const enums = (field.options ?? [])
        .map((o) => o.value)
        .filter((v) => typeof v === 'string' && v.length > 0)
      return enums.length
        ? { ...base, type: 'string', enum: enums }
        : { ...base, type: 'string' }
    }
    case 'textarea':
    case 'text':
    default:
      return { ...base, type: 'string' }
  }
}

/** Compile canonical fields → JSON Schema (draft-07 shaped). */
export function fieldsToJsonSchema(
  fields: FormFieldDef[],
  options?: { title?: string; description?: string },
): FormJsonSchema {
  const properties: Record<string, Record<string, unknown>> = {}
  const required: string[] = []

  for (const field of fields) {
    if (!field.name) continue
    properties[field.name] = propertyForField(field)
    if (field.type === 'checkbox') {
      if (field.required) required.push(field.name)
    } else if (field.required !== false) {
      required.push(field.name)
    }
  }

  const schema: FormJsonSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties,
    additionalProperties: false,
  }
  if (options?.title) schema.title = options.title
  if (options?.description) schema.description = options.description
  if (required.length) schema.required = required
  return schema
}

/** Prefer fields as source of truth; when schemaDirty, keep stored schema but still return fields. */
export function syncSchemaFromFields(
  fields: FormFieldDef[],
  previous: FormJsonSchema | undefined,
  options?: { title?: string; description?: string; schemaDirty?: boolean },
): FormJsonSchema {
  if (options?.schemaDirty && previous && previous.type === 'object') {
    return previous
  }
  return fieldsToJsonSchema(fields, {
    title: options?.title ?? previous?.title,
    description: options?.description ?? previous?.description,
  })
}

/** Parse a JSON Schema object from unknown (admin edit / storage). */
export function normalizeFormJsonSchema(raw: unknown, fallbackFields: FormFieldDef[]): FormJsonSchema {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>
    if (obj.type === 'object' && obj.properties && typeof obj.properties === 'object') {
      const properties: Record<string, Record<string, unknown>> = {}
      for (const [key, value] of Object.entries(obj.properties as Record<string, unknown>)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          properties[key] = value as Record<string, unknown>
        }
      }
      const required = Array.isArray(obj.required)
        ? obj.required.filter((x): x is string => typeof x === 'string')
        : undefined
      return {
        $schema:
          typeof obj.$schema === 'string'
            ? obj.$schema
            : 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: typeof obj.title === 'string' ? obj.title : undefined,
        description: typeof obj.description === 'string' ? obj.description : undefined,
        properties,
        required,
        additionalProperties:
          typeof obj.additionalProperties === 'boolean' ? obj.additionalProperties : false,
      }
    }
  }
  return fieldsToJsonSchema(fallbackFields)
}

/** Pretty JSON for the schema panel. */
export function stringifyFormJsonSchema(schema: FormJsonSchema): string {
  return JSON.stringify(schema, null, 2)
}
