'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { resolveFormCaptcha, verifyTurnstileToken } from './captcha'
import { normalizeFormFields } from './config'
import { checkFormRateLimit } from './rate-limit'
import { createFormSubmission, listFormSubmissions } from './store'
import type { FormFieldDef, FormSubmitActionState } from './types'

export type { FormSubmitActionState }

function clientIpFromHeaders(h: Headers): string {
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return h.get('x-real-ip')?.trim() || 'unknown'
}

function collectFieldValues(
  formData: FormData,
  fields: FormFieldDef[],
): { values: Record<string, string>; error?: string } {
  const values: Record<string, string> = {}
  for (const field of fields) {
    const raw = String(formData.get(field.name) ?? '').trim()
    if (field.required && !raw) {
      return { values, error: `${field.label} is required.` }
    }
    if (field.type === 'email' && raw) {
      // Lightweight email shape check (full RFC not needed for v1).
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return { values, error: `Enter a valid ${field.label.toLowerCase()}.` }
      }
    }
    values[field.name] = raw
  }
  return { values }
}

/**
 * Public Form particle submit — honeypot + rate limit + optional Turnstile.
 */
export async function submitFormAction(
  _prev: FormSubmitActionState,
  formData: FormData,
): Promise<FormSubmitActionState> {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
    return { error: 'Forms are disabled.' }
  }
  // Particle toggle (form) — also respect if explicitly off
  if (settings.moduleToggles?.form === false) {
    return { error: 'Forms are disabled.' }
  }

  const formKey = String(formData.get('formKey') ?? '').trim()
  const slotId = String(formData.get('slotId') ?? '').trim() || null
  const layoutId = String(formData.get('layoutId') ?? '').trim() || null
  if (!formKey) return { error: 'Missing form reference.' }

  // Honeypot — bots fill "website"; humans leave it empty (visually hidden).
  const honeypot = String(formData.get('website') ?? '')
  if (honeypot.trim() !== '') {
    // Pretend success so scrapers do not retry.
    return { ok: true, message: 'Thanks — your message was sent.' }
  }

  let fields: FormFieldDef[]
  try {
    const fieldsJson = String(formData.get('fieldsJson') ?? '[]')
    fields = normalizeFormFields(JSON.parse(fieldsJson))
  } catch {
    return { error: 'Invalid form definition.' }
  }

  const successMessage =
    String(formData.get('successMessage') ?? '').trim() ||
    'Thanks — your message was sent.'
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

  const { values, error: fieldError } = collectFieldValues(formData, fields)
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

  revalidatePath('/app/admin/forms')
  return { ok: true, message: successMessage }
}

export type FormAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
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
