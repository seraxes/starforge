'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { resolveFormCaptcha, verifyTurnstileToken } from './captcha'
import { normalizeFormFields, normalizeFormDefinitionDocument } from './definition'
import {
  createFormDefinition,
  deleteFormDefinition,
  duplicateFormDefinition,
  ensureDefaultContactFormSeeded,
  listFormDefinitions,
  loadFormDefinition,
  saveFormDefinitionDocument,
} from './definitions-store'
import { isFormPresetId } from './presets'
import { checkFormRateLimit } from './rate-limit'
import { normalizeFormJsonSchema, stringifyFormJsonSchema } from './schema-json'
import { validateFieldsWithZod } from './schema-zod'
import { createFormSubmission, listFormSubmissions } from './store'
import type {
  FormAdminActionState,
  FormDefinitionDocument,
  FormFieldDef,
  FormSubmitActionState,
} from './types'

export type { FormSubmitActionState, FormAdminActionState }

function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip')?.trim() || 'unknown'
}

function collectRawValues(
  formData: FormData,
  fields: FormFieldDef[],
): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of fields) {
    if (field.type === 'checkbox') {
      const raw = formData.get(field.name)
      values[field.name] = raw == null ? '' : String(raw)
    } else if (field.type === 'checkbox-group') {
      const all = formData
        .getAll(field.name)
        .map((v) => String(v).trim())
        .filter(Boolean)
      values[field.name] = all.join(',')
    } else if (field.type === 'computed') {
      // Server recomputes — ignore client tampering for storage path
      values[field.name] = String(formData.get(field.name) ?? '').trim()
    } else {
      values[field.name] = String(formData.get(field.name) ?? '').trim()
    }
  }
  return values
}

/**
 * Public Form particle submit — honeypot + rate limit + optional Turnstile.
 * Prefer definitionId → load fields from `sf_forms`; else fieldsJson (legacy).
 */
export async function submitFormAction(
  _prev: FormSubmitActionState,
  formData: FormData,
): Promise<FormSubmitActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    return { error: 'Forms are disabled.' }
  }
  if (settings.moduleToggles?.form === false) {
    return { error: 'Forms are disabled.' }
  }

  const formKey = String(formData.get('formKey') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim() || null
  const layoutId = String(formData.get('layoutId') ?? '').trim() || null
  const definitionIdRaw = String(formData.get('definitionId') ?? '').trim()
  if (!formKey) return { error: 'Missing form reference.' }

  const honeypot = String(formData.get('website') ?? '')
  if (honeypot.trim() !== '') {
    return { ok: true, message: 'Thanks — your message was sent.' }
  }

  let fields: FormFieldDef[]
  let successMessage =
    String(formData.get('successMessage') ?? '').trim() ||
    'Thanks — your message was sent.'
  let definitionId: string | null = null
  let definitionDocument: FormDefinitionDocument | null = null

  if (definitionIdRaw) {
    const loaded = await loadFormDefinition(definitionIdRaw)
    if (loaded.isFallback && loaded.source !== 'database' && definitionIdRaw !== 'contact') {
      return { error: 'Form definition not found.' }
    }
    fields = loaded.document.fields
    successMessage = loaded.document.successMessage || successMessage
    definitionId = loaded.id || definitionIdRaw
    definitionDocument = loaded.document
  } else {
    try {
      const fieldsJson = String(formData.get('fieldsJson') ?? '[]')
      fields = normalizeFormFields(JSON.parse(fieldsJson))
      if (fields.length === 0) {
        const { defaultFormFields } = await import('./definition')
        fields = defaultFormFields()
      }
    } catch {
      return { error: 'Invalid form definition.' }
    }
  }

  const useSiteCaptchaDefault = String(formData.get('useSiteCaptchaDefault') ?? '1') !== '0'

  const h = await headers()
  const ip = clientIpFromHeaders(h)
  const userAgent = h.get('user-agent')

  const limited = checkFormRateLimit(`form:${ip}:${formKey}`)
  if (!limited.ok) {
    return {
      error: `Too many submissions. Try again in ${limited.retryAfterSec ?? 60}s.`,
    }
  }

  const rawValues = collectRawValues(formData, fields)
  const { values, error: fieldError } = validateFieldsWithZod(fields, rawValues)
  if (fieldError) return { error: fieldError }

  const captcha = await resolveFormCaptcha({ useSiteCaptchaDefault })
  if (captcha.required && captcha.provider === 'turnstile') {
    if (captcha.misconfiguredReason && !captcha.siteKey) {
      return { error: 'Captcha is misconfigured. Please contact the site administrator.' }
    }
    const token = String(formData.get('cf-turnstile-response') ?? '').trim()
    const verified = await verifyTurnstileToken({ token, remoteip: ip })
    if (!verified.ok) {
      return { error: verified.error || 'Captcha verification failed.' }
    }
  }

  try {
    await createFormSubmission({
      formKey,
      definitionId,
      layoutId,
      slotId,
      payload: values,
      ipAddress: ip === 'unknown' ? null : ip,
      userAgent,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save your submission.'
    return { error: message }
  }

  if (definitionDocument) {
    try {
      const { dispatchFormEmailNotify, planFormEmailNotify } = await import('./email-notify')
      const plan = await planFormEmailNotify({
        document: definitionDocument,
        payload: values,
        formKey,
        definitionId,
      })
      await dispatchFormEmailNotify(plan)
    } catch {
      // Email stub must not fail the submission.
    }
  }

  revalidatePath('/app/admin/forms')
  revalidatePath('/app/admin/forms/submissions')
  return { ok: true, message: successMessage }
}

/** Admin-only gate for Forms area. */
export async function requireFormsAdmin(): Promise<{ error: string } | null> {
  const session = await requireAppAdmin()
  if (!session?.user) return { error: 'Admins only.' }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    return { error: 'Forms module is disabled.' }
  }
  return null
}

export async function listFormSubmissionsForAdmin(limit = 100) {
  const denied = await requireFormsAdmin()
  if (denied) throw new Error(denied.error)
  return listFormSubmissions({ limit })
}

export async function listFormDefinitionsForAdmin() {
  const denied = await requireFormsAdmin()
  if (denied) throw new Error(denied.error)
  await ensureDefaultContactFormSeeded()
  return listFormDefinitions()
}

function revalidateFormsAdmin(formId?: string) {
  revalidatePath('/app/admin/forms')
  revalidatePath('/app/admin/forms/submissions')
  revalidatePath('/app/admin/forms/settings')
  if (formId) revalidatePath(`/app/admin/forms/${formId}`)
}

export async function saveFormsModuleSettingsAction(
  _prev: FormAdminActionState,
  formData: FormData,
): Promise<FormAdminActionState> {
  const denied = await requireFormsAdmin()
  if (denied) return denied

  const { normalizeFormsModuleSettings } = await import('./module-settings')
  const { saveFormsModuleSettings } = await import('./settings-store')
  const settings = normalizeFormsModuleSettings({
    defaultAdminEmails: String(formData.get('defaultAdminEmails') ?? ''),
    fromAddress: String(formData.get('fromAddress') ?? ''),
    defaultSuccessMessage: String(formData.get('defaultSuccessMessage') ?? ''),
    transport: 'stub',
  })

  try {
    await saveFormsModuleSettings(settings)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save Forms Settings.',
    }
  }

  revalidateFormsAdmin()
  return { ok: true, message: 'Forms settings saved.' }
}

export async function createFormDefinitionAction(
  _prev: FormAdminActionState,
  formData: FormData,
): Promise<FormAdminActionState> {
  const denied = await requireFormsAdmin()
  if (denied) return denied

  const label = String(formData.get('label') ?? '').trim()
  if (!label) return { error: 'Name is required.' }
  const id = String(formData.get('id') ?? '').trim()
  const presetRaw = String(formData.get('preset') ?? 'contact').trim()
  const preset = isFormPresetId(presetRaw) ? presetRaw : 'contact'
  const copyFromId = String(formData.get('copyFromId') ?? '').trim()
  const openAfter = String(formData.get('openAfter') ?? '') === '1'

  let createdId: string
  try {
    const created = await createFormDefinition({
      label,
      id: id || undefined,
      preset,
      copyFromId: copyFromId || undefined,
    })
    createdId = created.id
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not create form.',
    }
  }

  revalidateFormsAdmin(createdId)
  if (openAfter) {
    redirect(`/app/admin/forms/${createdId}`)
  }
  return { ok: true, message: 'Form created.', formId: createdId }
}

export async function saveFormDefinitionAction(
  _prev: FormAdminActionState,
  formData: FormData,
): Promise<FormAdminActionState> {
  const denied = await requireFormsAdmin()
  if (denied) return denied

  const formId = String(formData.get('formId') ?? '').trim()
  if (!formId) return { error: 'Missing form id.' }

  let fields: unknown
  try {
    fields = JSON.parse(String(formData.get('fieldsJson') ?? '[]'))
  } catch {
    return { error: 'Invalid fields JSON.' }
  }

  const schemaDirty = String(formData.get('schemaDirty') ?? '') === '1'
  let schemaRaw: unknown
  try {
    schemaRaw = JSON.parse(String(formData.get('schemaJson') ?? '{}'))
  } catch {
    return { error: 'Invalid JSON Schema.' }
  }

  let sections: unknown
  try {
    sections = JSON.parse(String(formData.get('sectionsJson') ?? '[]'))
  } catch {
    sections = undefined
  }

  let emailNotify: unknown
  try {
    const raw = String(formData.get('emailNotifyJson') ?? '').trim()
    emailNotify = raw ? JSON.parse(raw) : undefined
  } catch {
    emailNotify = undefined
  }

  const presetRaw = String(formData.get('preset') ?? 'blank').trim()
  const document: FormDefinitionDocument = normalizeFormDefinitionDocument({
    version: 1,
    preset: isFormPresetId(presetRaw) ? presetRaw : 'blank',
    title: String(formData.get('title') ?? '').trim() || 'Untitled form',
    description: String(formData.get('description') ?? '').trim(),
    fields: normalizeFormFields(fields),
    sections,
    schema: normalizeFormJsonSchema(schemaRaw, normalizeFormFields(fields)),
    schemaDirty,
    successMessage: String(formData.get('successMessage') ?? '').trim(),
    submitLabel: String(formData.get('submitLabel') ?? '').trim() || 'Submit',
    useSiteCaptchaDefault: String(formData.get('useSiteCaptchaDefault') ?? '') === 'on',
    emailNotify,
  })

  // If not dirty, regenerate schema from fields (ignore pasted schema for storage sync)
  if (!schemaDirty) {
    document.schema = normalizeFormJsonSchema(
      undefined,
      document.fields,
    )
    // title/description onto schema via normalize path
    const { fieldsToJsonSchema } = await import('./schema-json')
    document.schema = fieldsToJsonSchema(document.fields, {
      title: document.title,
      description: document.description,
    })
  }

  try {
    await saveFormDefinitionDocument(formId, document, document.title)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not save form.',
    }
  }

  revalidateFormsAdmin(formId)
  return { ok: true, message: 'Form saved.' }
}

export async function deleteFormDefinitionAction(
  _prev: FormAdminActionState,
  formData: FormData,
): Promise<FormAdminActionState> {
  const denied = await requireFormsAdmin()
  if (denied) return denied

  const formId = String(formData.get('formId') ?? '').trim()
  if (!formId) return { error: 'Missing form id.' }

  try {
    await deleteFormDefinition(formId)
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not delete form.',
    }
  }

  revalidateFormsAdmin()
  return { ok: true, message: 'Form deleted.' }
}

export async function duplicateFormDefinitionAction(
  _prev: FormAdminActionState,
  formData: FormData,
): Promise<FormAdminActionState> {
  const denied = await requireFormsAdmin()
  if (denied) return denied

  const formId = String(formData.get('formId') ?? '').trim()
  if (!formId) return { error: 'Missing form id.' }
  const label = String(formData.get('label') ?? '').trim()

  try {
    const created = await duplicateFormDefinition(formId, label || undefined)
    revalidateFormsAdmin(created.id)
    return { ok: true, message: 'Form duplicated.', formId: created.id }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Could not duplicate form.',
    }
  }
}

/** Expose schema stringify for server components if needed. */
export async function previewFormSchemaAction(fieldsJson: string): Promise<string> {
  try {
    const fields = normalizeFormFields(JSON.parse(fieldsJson))
    const { fieldsToJsonSchema } = await import('./schema-json')
    return stringifyFormJsonSchema(fieldsToJsonSchema(fields))
  } catch {
    return '{}'
  }
}

export { loadFormDefinition, ensureDefaultContactFormSeeded, listFormDefinitions }
