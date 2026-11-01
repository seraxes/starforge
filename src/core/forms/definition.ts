import { fieldsToJsonSchema, normalizeFormJsonSchema, syncSchemaFromFields } from './schema-json'
import {
  DEFAULT_CONTACT_FORM_ID,
  defaultMessagesForPreset,
  fieldsForPreset,
  isFormPresetId,
} from './presets'
import type {
  FormDefinitionDocument,
  FormFieldDef,
  FormFieldOption,
  FormFieldType,
  FormPresetId,
} from './types'
import { isFormFieldType } from './schema-json'

const RESERVED_NAMES = new Set(['website', 'cf-turnstile-response'])

function newFieldId(): string {
  return `fld_${Math.random().toString(36).slice(2, 10)}`
}

function slugifyName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:-]/g, '')
}

function normalizeOptions(raw: unknown): FormFieldOption[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const options: FormFieldOption[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const value =
      typeof row.value === 'string'
        ? row.value.trim()
        : typeof row.label === 'string'
          ? row.label.trim()
          : ''
    if (!value) continue
    const label =
      typeof row.label === 'string' && row.label.trim() ? row.label.trim() : value
    options.push({ value, label })
  }
  return options.length ? options : undefined
}

export function normalizeFormFields(raw: unknown): FormFieldDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return []

  const fields: FormFieldDef[] = []
  const seen = new Set<string>()

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? slugifyName(row.name) : ''
    if (!name || seen.has(name)) continue
    if (RESERVED_NAMES.has(name) || name.startsWith('_')) continue
    seen.add(name)

    const type: FormFieldType = isFormFieldType(row.type) ? row.type : 'text'
    const field: FormFieldDef = {
      id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newFieldId(),
      name,
      label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : name,
      type,
      required: row.required !== false,
      placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
    }
    if (typeof row.description === 'string' && row.description.trim()) {
      field.description = row.description.trim()
    }
    if (type === 'select') {
      field.options = normalizeOptions(row.options) ?? [
        { value: 'option_a', label: 'Option A' },
        { value: 'option_b', label: 'Option B' },
      ]
    }
    if (type === 'checkbox') {
      // Checkbox default: not required unless explicitly true
      field.required = row.required === true
    }
    fields.push(field)
  }

  return fields
}

/** Legacy SF-48 default: contact triad when inline fields empty. */
export function defaultFormFields(): FormFieldDef[] {
  return fieldsForPreset('contact')
}

export function emptyFormDefinitionDocument(
  preset: FormPresetId = 'blank',
): FormDefinitionDocument {
  const meta = defaultMessagesForPreset(preset)
  const fields = fieldsForPreset(preset)
  return {
    version: 1,
    preset,
    title: meta.title,
    description: meta.description,
    fields,
    schema: fieldsToJsonSchema(fields, {
      title: meta.title,
      description: meta.description,
    }),
    schemaDirty: false,
    successMessage: meta.successMessage,
    submitLabel: meta.submitLabel,
    useSiteCaptchaDefault: true,
  }
}

export function normalizeFormDefinitionDocument(raw: unknown): FormDefinitionDocument {
  const base = emptyFormDefinitionDocument('blank')
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base

  const obj = raw as Record<string, unknown>
  const preset: FormPresetId = isFormPresetId(obj.preset) ? obj.preset : 'blank'
  const fields = normalizeFormFields(obj.fields)
  const title =
    typeof obj.title === 'string' && obj.title.trim()
      ? obj.title.trim()
      : defaultMessagesForPreset(preset).title
  const description =
    typeof obj.description === 'string' ? obj.description.trim() : undefined
  const schemaDirty = obj.schemaDirty === true
  const schema = schemaDirty
    ? normalizeFormJsonSchema(obj.schema, fields)
    : syncSchemaFromFields(fields, undefined, { title, description })

  return {
    version: 1,
    preset,
    title,
    description,
    fields,
    schema,
    schemaDirty,
    successMessage:
      typeof obj.successMessage === 'string' && obj.successMessage.trim()
        ? obj.successMessage.trim()
        : defaultMessagesForPreset(preset).successMessage,
    submitLabel:
      typeof obj.submitLabel === 'string' && obj.submitLabel.trim()
        ? obj.submitLabel.trim()
        : defaultMessagesForPreset(preset).submitLabel,
    useSiteCaptchaDefault: obj.useSiteCaptchaDefault !== false,
  }
}

export function parseFormDefinitionJson(raw: string): FormDefinitionDocument {
  try {
    return normalizeFormDefinitionDocument(JSON.parse(raw) as unknown)
  } catch {
    return emptyFormDefinitionDocument('contact')
  }
}

export function serializeFormDefinitionDocument(doc: FormDefinitionDocument): string {
  const normalized = normalizeFormDefinitionDocument(doc)
  return JSON.stringify(normalized)
}

export function slugifyFormId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return slug || `form-${Date.now().toString(36)}`
}

export { DEFAULT_CONTACT_FORM_ID }

export function createFieldDraft(type: FormFieldType = 'text'): FormFieldDef {
  const id = newFieldId()
  const baseName = type === 'textarea' ? 'message' : type === 'email' ? 'email' : type
  return {
    id,
    name: `${baseName}_${id.slice(-4)}`,
    label: type === 'email' ? 'Email' : type.charAt(0).toUpperCase() + type.slice(1),
    type,
    required: type !== 'checkbox',
    placeholder: '',
    ...(type === 'select'
      ? {
          options: [
            { value: 'option_a', label: 'Option A' },
            { value: 'option_b', label: 'Option B' },
          ],
        }
      : {}),
  }
}
