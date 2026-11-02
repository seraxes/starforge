import type { FormFieldDef, FormFieldType, FormJsonSchema } from './types'

const FIELD_TYPES = new Set<FormFieldType>([
  'text',
  'email',
  'textarea',
  'number',
  'tel',
  'url',
  'select',
  'radio',
  'checkbox',
  'checkbox-group',
  'date',
  'time',
  'datetime',
  'file',
  'hidden',
  'computed',
])

/** Extension keys for Starforge field metadata on JSON Schema properties. */
export const SF_DATE_CONSTRAINTS_KEY = 'x-sf-dateConstraints' as const
export const SF_LOGIC_KEY = 'x-sf-logic' as const
export const SF_COMPUTED_KEY = 'x-sf-computed' as const
export const SF_VALIDATE_EXPR_KEY = 'x-sf-validateExpr' as const
export const SF_NUMBER_BOUNDS_KEY = 'x-sf-numberBounds' as const
export const SF_OPTIONS_MEDIA_KEY = 'x-sf-options' as const
export const SF_STRING_CONSTRAINTS_KEY = 'x-sf-stringConstraints' as const
export const SF_UPLOAD_KEY = 'x-sf-upload' as const
export const SF_DEFAULT_VALUE_KEY = 'x-sf-defaultValue' as const
export const SF_FIELD_TYPE_KEY = 'x-sf-fieldType' as const

export function isFormFieldType(value: unknown): value is FormFieldType {
  return typeof value === 'string' && FIELD_TYPES.has(value as FormFieldType)
}

function dateTimeProperty(
  field: FormFieldDef,
  format: 'date' | 'time' | 'date-time',
  base: Record<string, unknown>,
): Record<string, unknown> {
  const prop: Record<string, unknown> = { ...base, type: 'string', format }
  const c = field.constraints
  if (!c) return prop
  const ext: Record<string, unknown> = {}
  if (c.min) ext.min = c.min
  if (c.max) ext.max = c.max
  if (c.weekdays?.length) ext.weekdays = [...c.weekdays]
  if (c.daysOfMonth?.length) ext.daysOfMonth = [...c.daysOfMonth]
  if (Object.keys(ext).length) prop[SF_DATE_CONSTRAINTS_KEY] = ext
  return prop
}

function attachLogicExtensions(
  field: FormFieldDef,
  prop: Record<string, unknown>,
): Record<string, unknown> {
  prop[SF_FIELD_TYPE_KEY] = field.type
  if (field.defaultValue != null && field.defaultValue !== '') {
    prop.default = field.defaultValue
    prop[SF_DEFAULT_VALUE_KEY] = field.defaultValue
  }
  if (field.stringConstraints) prop[SF_STRING_CONSTRAINTS_KEY] = field.stringConstraints
  if (field.upload) prop[SF_UPLOAD_KEY] = field.upload
  if (field.logic) prop[SF_LOGIC_KEY] = field.logic
  if (field.computed) prop[SF_COMPUTED_KEY] = field.computed
  if (field.validateExpr) prop[SF_VALIDATE_EXPR_KEY] = field.validateExpr
  if (field.numberBounds) prop[SF_NUMBER_BOUNDS_KEY] = field.numberBounds
  if (field.options?.some((o) => o.media)) {
    prop[SF_OPTIONS_MEDIA_KEY] = field.options.map((o) => ({
      value: o.value,
      label: o.label,
      ...(o.media ? { media: o.media } : {}),
    }))
  }
  return prop
}

function propertyForField(field: FormFieldDef): Record<string, unknown> {
  const base: Record<string, unknown> = {
    title: field.label,
  }
  if (field.description) base.description = field.description

  let prop: Record<string, unknown>
  switch (field.type) {
    case 'email':
      prop = { ...base, type: 'string', format: 'email' }
      break
    case 'number':
    case 'computed':
      prop = { ...base, type: 'number', ...(field.type === 'computed' ? { readOnly: true } : {}) }
      break
    case 'checkbox':
      prop = { ...base, type: 'boolean' }
      break
    case 'url':
      prop = { ...base, type: 'string', format: 'uri' }
      break
    case 'tel':
      prop = { ...base, type: 'string' }
      break
    case 'date':
      prop = dateTimeProperty(field, 'date', base)
      break
    case 'time':
      prop = dateTimeProperty(field, 'time', base)
      break
    case 'datetime':
      prop = dateTimeProperty(field, 'date-time', base)
      break
    case 'select':
    case 'radio': {
      const enums = (field.options ?? [])
        .map((o) => o.value)
        .filter((v) => typeof v === 'string' && v.length > 0)
      prop = enums.length
        ? { ...base, type: 'string', enum: enums }
        : { ...base, type: 'string' }
      break
    }
    case 'checkbox-group': {
      const enums = (field.options ?? [])
        .map((o) => o.value)
        .filter((v) => typeof v === 'string' && v.length > 0)
      prop = {
        ...base,
        type: 'array',
        items: enums.length ? { type: 'string', enum: enums } : { type: 'string' },
        uniqueItems: true,
      }
      break
    }
    case 'file':
      prop = {
        ...base,
        type: 'string',
        description:
          (typeof base.description === 'string' ? base.description + ' ' : '') +
          '(Payload media id)',
      }
      break
    case 'hidden':
      prop = { ...base, type: 'string', readOnly: true }
      break
    case 'textarea':
    case 'text':
    default:
      prop = { ...base, type: 'string' }
      break
  }

  const sc = field.stringConstraints
  if (sc && prop.type === 'string') {
    if (typeof sc.minLength === 'number') prop.minLength = sc.minLength
    if (typeof sc.maxLength === 'number') prop.maxLength = sc.maxLength
    if (sc.pattern) prop.pattern = sc.pattern
  }

  return attachLogicExtensions(field, prop)
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
    if (field.type === 'checkbox' || field.type === 'checkbox-group') {
      if (field.required) required.push(field.name)
    } else if (field.type === 'computed' || field.type === 'hidden') {
      // computed always derived; hidden uses defaultValue — not user-required
    } else if (field.type === 'file') {
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
