'use server'

import { requireAppAdmin } from '@/core/auth/admin'
import { invalidateSiteChrome } from '@/core/content/revalidate'
import {
  isBootstrapLocale,
  isValidLocaleCode,
  normalizeLocaleCode,
  registerPublicLocaleCodes,
  type LocaleCatalogEntry,
} from '@/core/i18n/locales'

import { normalizeLocaleCatalog } from './normalize'
import { getLocalizationSettings, saveLocalizationSettings } from './store'

export type LocalizationActionState = {
  error?: string
  ok?: boolean
  message?: string
}

function parseBool(formData: FormData, key: string): boolean {
  const raw = formData.get(key)
  return raw === 'on' || raw === 'true' || raw === '1'
}

function parseCatalogFromForm(formData: FormData): LocaleCatalogEntry[] {
  const codes = formData.getAll('catalogCode').map((v) => String(v))
  const labels = formData.getAll('catalogLabel').map((v) => String(v))
  const entries: LocaleCatalogEntry[] = []
  for (let i = 0; i < codes.length; i++) {
    const code = normalizeLocaleCode(codes[i] || '')
    if (!isValidLocaleCode(code)) continue
    const label = (labels[i] || '').trim() || code
    entries.push({ code, label: label.slice(0, 64) })
  }
  return normalizeLocaleCatalog(entries)
}

function parseLocalesEnabled(
  formData: FormData,
  catalogCodes: ReadonlySet<string>,
): string[] {
  const raw = formData.getAll('localesEnabled')
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    const code = normalizeLocaleCode(String(entry))
    if (!catalogCodes.has(code) || seen.has(code)) continue
    seen.add(code)
    out.push(code)
  }
  return out
}

/**
 * Bust Site Chrome / proxy caches after a locale change.
 *
 * Do **not** call `revalidatePath('/', 'layout')` or `revalidatePath` on this
 * admin route here. Enabling a locale + path revalidation forces Next to rebuild
 * the public `[locale]` tree in the same action response; combined with
 * `useActionState` that has hung the process until restart. Tag invalidation +
 * the form’s `router.refresh()` is enough — proxy reloads enabled locales per
 * request from Chrome JSON.
 */
async function revalidateLocalizationCaches() {
  await invalidateSiteChrome()
}

export async function updateLocalizationAction(
  _prev: LocalizationActionState,
  formData: FormData,
): Promise<LocalizationActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Localization.' }
  }

  const localeCatalog = parseCatalogFromForm(formData)
  if (localeCatalog.length === 0) {
    return { error: 'Keep at least one locale in the catalog.' }
  }

  const catalogCodes = new Set(localeCatalog.map((e) => e.code))
  let localesEnabled = parseLocalesEnabled(formData, catalogCodes)
  if (localesEnabled.length === 0) {
    return { error: 'Enable at least one locale.' }
  }

  const defaultRaw = normalizeLocaleCode(String(formData.get('defaultLocale') ?? ''))
  if (!catalogCodes.has(defaultRaw)) {
    return { error: 'Default locale must be in the catalog.' }
  }
  if (!localesEnabled.includes(defaultRaw)) {
    return { error: 'Default locale must be one of the enabled locales.' }
  }

  // Optional add-locale fields on the same form (code + label).
  const addCode = normalizeLocaleCode(String(formData.get('addLocaleCode') ?? ''))
  const addLabel = String(formData.get('addLocaleLabel') ?? '').trim()
  if (addCode) {
    if (!isValidLocaleCode(addCode)) {
      return {
        error:
          'New locale code must look like a language tag (e.g. de, fr, en-US, pt-BR).',
      }
    }
    if (catalogCodes.has(addCode)) {
      return { error: `Locale “${addCode}” is already in the catalog.` }
    }
    localeCatalog.push({
      code: addCode,
      label: (addLabel || addCode).slice(0, 64),
    })
    catalogCodes.add(addCode)
    if (formData.get('addLocaleEnable') === 'on' || formData.get('addLocaleEnable') === 'true') {
      localesEnabled = [...localesEnabled, addCode]
    }
  }

  try {
    await saveLocalizationSettings({
      localeCatalog,
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

  registerPublicLocaleCodes(localeCatalog.map((e) => e.code))
  await revalidateLocalizationCaches()
  return {
    ok: true,
    message: addCode ? `Added locale “${addCode}”.` : undefined,
  }
}

/** Remove a non-bootstrap catalog locale (must not be the last / only enabled). */
export async function removeLocaleFromCatalogAction(
  _prev: LocalizationActionState,
  formData: FormData,
): Promise<LocalizationActionState> {
  const admin = await requireAppAdmin()
  if (!admin) {
    return { error: 'Sign in as a Starforge app admin to edit Localization.' }
  }

  const code = normalizeLocaleCode(String(formData.get('removeLocaleCode') ?? ''))
  if (!isValidLocaleCode(code)) {
    return { error: 'Invalid locale code.' }
  }
  if (isBootstrapLocale(code)) {
    return { error: `Cannot remove bootstrap locale “${code}” from the catalog.` }
  }

  const current = await getLocalizationSettings()
  if (!current.localeCatalog.some((e) => e.code === code)) {
    return { error: `Locale “${code}” is not in the catalog.` }
  }

  const nextCatalog = current.localeCatalog.filter((e) => e.code !== code)
  if (nextCatalog.length === 0) {
    return { error: 'Cannot remove the last locale from the catalog.' }
  }

  const nextEnabled = current.localesEnabled.filter((c) => c !== code)
  if (nextEnabled.length === 0) {
    return { error: 'Cannot remove the last enabled locale. Enable another locale first.' }
  }

  let nextDefault = current.defaultLocale
  if (nextDefault === code) {
    nextDefault = nextEnabled[0]!
  }

  try {
    await saveLocalizationSettings({
      localeCatalog: nextCatalog,
      localesEnabled: nextEnabled,
      defaultLocale: nextDefault,
      localeFallback: current.localeFallback,
    })
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Could not remove locale.'
    return { error: message }
  }

  registerPublicLocaleCodes(nextCatalog.map((e) => e.code))
  await revalidateLocalizationCaches()
  return { ok: true, message: `Removed locale “${code}”.` }
}
