import {
  isDateTimeFieldType,
  normalizeDateTimeConstraints,
} from './date-constraints'
import { normalizeFieldLogic } from './logic'
import { fieldsToJsonSchema, normalizeFormJsonSchema, syncSchemaFromFields } from './schema-json'
import {
  DEFAULT_CONTACT_FORM_ID,
  defaultMessagesForPreset,
  fieldsForPreset,
  isFormPresetId,
} from './presets'
import type {
  FormComputedConfig,
  FormDefinitionDocument,
  FormEmailNotifyConfig,
  FormFieldDef,
  FormFieldOption,
  FormFieldType,
  FormNumberBounds,
  FormOptionMedia,
  FormPresetId,
  FormSectionDef,
  FormValidateExpr,
} from './types'
import { isFormFieldType } from './schema-json'

const RESERVED_NAMES = new Set(['website', 'cf-turnstile-response'])

const OPTION_TYPES = new Set<FormFieldType>(['select', 'radio', 'checkbox-group'])

function newFieldId(): string {
  return `fld_${Math.random().toString(36).slice(2, 10)}`
}

function newSectionId(): string {
  return `sec_${Math.random().toString(36).slice(2, 10)}`
}

function slugifyName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_:-]/g, '')
}

function normalizeOptionMedia(raw: unknown): FormOptionMedia | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const media: FormOptionMedia = {}
  if (typeof row.mediaId === 'string' && row.mediaId.trim()) media.mediaId = row.mediaId.trim()
  if (typeof row.url === 'string' && row.url.trim()) media.url = row.url.trim()
  if (typeof row.alt === 'string' && row.alt.trim()) media.alt = row.alt.trim()
  if (row.kind === 'image' || row.kind === 'icon' || row.kind === 'file') media.kind = row.kind
  if (!media.mediaId && !media.url) return undefined
  if (!media.kind) {
    media.kind = media.url && /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(media.url) ? 'image' : 'file'
  }
  return media
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
    const option: FormFieldOption = { value, label }
    const media = normalizeOptionMedia(row.media)
    if (media) option.media = media
    options.push(option)
  }
  return options.length ? options : undefined
}

function defaultOptions(): FormFieldOption[] {
  return [
    { value: 'option_a', label: 'Option A' },
    { value: 'option_b', label: 'Option B' },
  ]
}

function normalizeComputed(raw: unknown): FormComputedConfig | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const expression = typeof row.expression === 'string' ? row.expression.trim() : ''
  if (!expression) return undefined
  const precision =
    typeof row.precision === 'number' && Number.isFinite(row.precision)
      ? Math.max(0, Math.min(8, Math.floor(row.precision)))
      : undefined
  return precision != null ? { expression, precision } : { expression }
}

function normalizeValidateExpr(raw: unknown): FormValidateExpr | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const expression = typeof row.expression === 'string' ? row.expression.trim() : ''
  if (!expression) return undefined
  const message =
    typeof row.message === 'string' && row.message.trim() ? row.message.trim() : undefined
  return message ? { expression, message } : { expression }
}

function normalizeNumberBounds(raw: unknown): FormNumberBounds | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const bounds: FormNumberBounds = {}
  if (typeof row.min === 'number' && Number.isFinite(row.min)) bounds.min = row.min
  if (typeof row.max === 'number' && Number.isFinite(row.max)) bounds.max = row.max
  if (typeof row.minExpr === 'string' && row.minExpr.trim()) bounds.minExpr = row.minExpr.trim()
  if (typeof row.maxExpr === 'string' && row.maxExpr.trim()) bounds.maxExpr = row.maxExpr.trim()
  if (
    bounds.min == null &&
    bounds.max == null &&
    !bounds.minExpr &&
    !bounds.maxExpr
  ) {
    return undefined
  }
  return bounds
}

function normalizeEmailNotify(raw: unknown): FormEmailNotifyConfig | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const row = raw as Record<string, unknown>
  const cfg: FormEmailNotifyConfig = {}
  if (row.notifyAdmin === true) cfg.notifyAdmin = true
  if (row.notifyRespondent === true) cfg.notifyRespondent = true
  if (typeof row.respondentEmailField === 'string' && row.respondentEmailField.trim()) {
    cfg.respondentEmailField = slugifyName(row.respondentEmailField)
  }
  if (Array.isArray(row.adminEmails)) {
    const emails = row.adminEmails
      .map((e) => (typeof e === 'string' ? e.trim() : ''))
      .filter(Boolean)
    if (emails.length) cfg.adminEmails = emails
  }
  if (typeof row.adminSubject === 'string' && row.adminSubject.trim()) {
    cfg.adminSubject = row.adminSubject.trim()
  }
  if (typeof row.respondentSubject === 'string' && row.respondentSubject.trim()) {
    cfg.respondentSubject = row.respondentSubject.trim()
  }
  if (
    !cfg.notifyAdmin &&
    !cfg.notifyRespondent &&
    !cfg.adminEmails &&
    !cfg.adminSubject &&
    !cfg.respondentSubject &&
    !cfg.respondentEmailField
  ) {
    return undefined
  }
  return cfg
}

export function normalizeFormSections(
  raw: unknown,
  fields: FormFieldDef[],
): FormSectionDef[] {
  const names = fields.map((f) => f.name)
  const nameSet = new Set(names)
  if (Array.isArray(raw) && raw.length > 0) {
    const sections: FormSectionDef[] = []
    const assigned = new Set<string>()
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue
      const row = entry as Record<string, unknown>
      const id =
        typeof row.id === 'string' && row.id.trim() ? row.id.trim() : newSectionId()
      const label =
        typeof row.label === 'string' && row.label.trim() ? row.label.trim() : 'Section'
      const fieldNames = Array.isArray(row.fieldNames)
        ? row.fieldNames
            .filter((n): n is string => typeof n === 'string' && nameSet.has(n))
            .filter((n) => {
              if (assigned.has(n)) return false
              assigned.add(n)
              return true
            })
        : []
      sections.push({ id, label, fieldNames })
    }
    const orphan = names.filter((n) => !assigned.has(n))
    if (sections.length === 0) {
      return [{ id: 'sec_main', label: 'Fields', fieldNames: names }]
    }
    if (orphan.length) {
      sections[0] = {
        ...sections[0]!,
        fieldNames: [...sections[0]!.fieldNames, ...orphan],
      }
    }
    return sections
  }
  return [{ id: 'sec_main', label: 'Fields', fieldNames: names }]
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
    if (OPTION_TYPES.has(type)) {
      field.options = normalizeOptions(row.options) ?? defaultOptions()
    }
    if (type === 'checkbox' || type === 'checkbox-group') {
      field.required = row.required === true
    }
    if (type === 'computed') {
      field.required = false
      field.computed = normalizeComputed(row.computed) ?? {
        expression: '0',
        precision: 2,
      }
    }
    if (isDateTimeFieldType(type)) {
      const constraints = normalizeDateTimeConstraints(type, row.constraints)
      if (constraints) field.constraints = constraints
    }
    const logic = normalizeFieldLogic(row.logic)
    if (logic) field.logic = logic
    const validateExpr = normalizeValidateExpr(row.validateExpr)
    if (validateExpr) field.validateExpr = validateExpr
    if (type === 'number' || type === 'computed') {
      const numberBounds = normalizeNumberBounds(row.numberBounds)
      if (numberBounds) field.numberBounds = numberBounds
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
    sections: normalizeFormSections(undefined, fields),
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
  const sections = normalizeFormSections(obj.sections, fields)
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
  const emailNotify = normalizeEmailNotify(obj.emailNotify)

  return {
    version: 1,
    preset,
    title,
    description,
    fields,
    sections,
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
    emailNotify,
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

const FIELD_DRAFT_LABELS: Partial<Record<FormFieldType, string>> = {
  email: 'Email',
  textarea: 'Message',
  tel: 'Phone',
  url: 'URL',
  datetime: 'Date & time',
  date: 'Date',
  time: 'Time',
  radio: 'Radio',
  'checkbox-group': 'Choices',
  computed: 'Computed',
  select: 'Select',
  checkbox: 'Checkbox',
}

export function createFieldDraft(type: FormFieldType = 'text'): FormFieldDef {
  const id = newFieldId()
  const baseName =
    type === 'textarea'
      ? 'message'
      : type === 'email'
        ? 'email'
        : type === 'datetime'
          ? 'datetime'
          : type === 'checkbox-group'
            ? 'choices'
            : type
  const draft: FormFieldDef = {
    id,
    name: `${baseName}_${id.slice(-4)}`,
    label: FIELD_DRAFT_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
    type,
    required: type !== 'checkbox' && type !== 'checkbox-group' && type !== 'computed',
    placeholder: '',
  }
  if (OPTION_TYPES.has(type)) {
    draft.options = defaultOptions()
  }
  if (type === 'computed') {
    draft.computed = { expression: '0', precision: 2 }
  }
  return draft
}

export function createSectionDraft(label = 'Section'): FormSectionDef {
  return { id: newSectionId(), label, fieldNames: [] }
}
