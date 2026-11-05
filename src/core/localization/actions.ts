'use server'

import { revalidatePath } from 'next/cache'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteChrome } from '@/core/content/revalidate'
import { isAppLocale, LOCALES } from '@/core/i18n/locales'

import { saveLocalizationSettings } from './store'

export type LocalizationActionState = {
  error?: string
  ok?: boolean
}

function parseBool(formData: FormData, key: string): boolean {
  const raw = formData.get(key)
  return raw === 'on' || raw === 'true' || raw === '1'
}

function parseLocalesEnabled(formData: FormData): string[] {
  const raw = formData.getAll('localesEnabled')
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    const code = String(entry).trim()
    if (!isAppLocale(code) || seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  return out
}

export async function updateLocalizationAction(
  _prev: LocalizationActionState,
  formData: FormData,
): Promise<LocalizationActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Localization.' }
  }

  const localesEnabled = parseLocalesEnabled(formData)
  if (localesEnabled.length === 0) {
    return {
      error: `Enable at least one locale (${LOCALES.join(', ')}).`,
    }
  }

  const defaultRaw = String(formData.get('defaultLocale') ?? '').trim()
  if (!isAppLocale(defaultRaw)) {
    return { error: 'Default locale must be a known platform locale.' }
  }
  if (!localesEnabled.includes(defaultRaw)) {
    return { error: 'Default locale must be one of the enabled locales.' }
  }

  try {
    await saveLocalizationSettings({
      localesEnabled,
      defaultLocale: defaultRaw,
      localeFallback: parseBool(formData, 'localeFallback'),
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not save Localization.'
    return { error: message }
  }

  await invalidateSiteChrome()
  revalidatePath('/', 'layout')
  revalidatePath('/admin/localization')
  revalidatePath('/admin/site-chrome')
  revalidatePath('/admin')
  return { ok: true }
}
