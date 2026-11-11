'use server'

import { revalidatePath } from 'next/cache'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'

import { requireAppAdmin } from '@/core/auth/admin'
import { getLocalizationSettings } from '@/core/localization/store'
import { isValidLocaleCode, normalizeLocaleCode } from '@/core/i18n/locales'

import { isValidContentLocaleKey } from '../content-locale-keys'
import { migrateEmbeddedContentLocalesToFiles } from './migrate'
import {
  invalidateContentLocaleCatalog,
  listContentLocaleFiles,
  normalizeContentLocaleFileMap,
  readContentLocaleFile,
  writeContentLocaleFile,
} from './store'
import type { ContentLocaleScope } from './paths'

export type ContentLocaleFilesActionState = {
  ok?: boolean
  error?: string
  message?: string
  /** Returned after save so the editor can refresh. */
  text?: string
}

function parseScope(raw: string): ContentLocaleScope | null {
  return raw === 'layouts' || raw === 'nav' ? raw : null
}

async function requireAdmin() {
  const session = await requireAppAdmin()
  if (!session) return { error: 'Sign in as a Starforge app admin.' as const }
  return { session }
}

export async function saveContentLocaleFileAction(
  _prev: ContentLocaleFilesActionState,
  formData: FormData,
): Promise<ContentLocaleFilesActionState> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const locale = normalizeLocaleCode(String(formData.get('locale') ?? ''))
  const scope = parseScope(String(formData.get('scope') ?? ''))
  const ownerId = String(formData.get('ownerId') ?? '').trim()
  const text = String(formData.get('text') ?? '')
  if (!isValidLocaleCode(locale) || !scope || !ownerId) {
    return { error: 'Pick a locale and a locale file.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'JSON is invalid — fix syntax before saving.' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'Locale file must be a JSON object of key → string.' }
  }

  for (const key of Object.keys(parsed as Record<string, unknown>)) {
    if (key.startsWith('_')) continue
    if (!isValidContentLocaleKey(key)) {
      return { error: `Invalid content key “${key}”. Do not rename keys.` }
    }
  }

  await writeContentLocaleFile(locale, scope, ownerId, normalizeContentLocaleFileMap(parsed))
  revalidatePath('/admin/localization')
  return {
    ok: true,
    message: `Saved ${locale}/${scope}/${ownerId}.json`,
    text: `${JSON.stringify(normalizeContentLocaleFileMap(parsed), null, 2)}\n`,
  }
}

export async function loadContentLocaleFileTextAction(
  locale: string,
  scope: ContentLocaleScope,
  ownerId: string,
): Promise<{ text: string; error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { text: '{\n}\n', error: gate.error }
  const map = await readContentLocaleFile(locale, scope, ownerId)
  return { text: `${JSON.stringify(map, null, 2)}\n` }
}

export async function migrateContentLocalesAction(): Promise<ContentLocaleFilesActionState> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }
  const result = await migrateEmbeddedContentLocalesToFiles()
  revalidatePath('/admin/localization')
  revalidatePath('/admin/layouts')
  revalidatePath('/admin/nav')
  return {
    ok: true,
    message: `Migrated ${result.slotsTouched} slots across ${result.layouts} layouts and ${result.navMenus} nav menus.`,
  }
}

export async function downloadContentLocaleFileAction(
  locale: string,
  scope: ContentLocaleScope,
  ownerId: string,
): Promise<{ filename: string; text: string; error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { filename: '', text: '', error: gate.error }
  const map = await readContentLocaleFile(locale, scope, ownerId)
  return {
    filename: `${locale}-${scope}-${ownerId}.json`,
    text: `${JSON.stringify(map, null, 2)}\n`,
  }
}

export async function downloadContentLocaleZipAction(
  locale: string,
): Promise<{ filename: string; base64: string; error?: string }> {
  const gate = await requireAdmin()
  if ('error' in gate) return { filename: '', base64: '', error: gate.error }
  const code = normalizeLocaleCode(locale)
  const files = await listContentLocaleFiles(code)
  const zipFiles: Record<string, Uint8Array> = {}
  for (const file of files) {
    const map = await readContentLocaleFile(code, file.scope, file.ownerId)
    zipFiles[`${code}/${file.relativePath}`] = strToU8(
      `${JSON.stringify(map, null, 2)}\n`,
    )
  }
  if (Object.keys(zipFiles).length === 0) {
    zipFiles[`${code}/.keep`] = strToU8('')
  }
  const bytes = zipSync(zipFiles, { level: 6 })
  return {
    filename: `content-locales-${code}.zip`,
    base64: Buffer.from(bytes).toString('base64'),
  }
}

export async function uploadContentLocaleFileAction(
  _prev: ContentLocaleFilesActionState,
  formData: FormData,
): Promise<ContentLocaleFilesActionState> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const locale = normalizeLocaleCode(String(formData.get('locale') ?? ''))
  const scope = parseScope(String(formData.get('scope') ?? ''))
  const ownerId = String(formData.get('ownerId') ?? '').trim()
  const mode = String(formData.get('mode') ?? 'replace')
  const file = formData.get('file')
  if (!isValidLocaleCode(locale) || !scope || !ownerId) {
    return { error: 'Pick a locale and a locale file target.' }
  }
  if (!(file instanceof File)) return { error: 'Choose a JSON file to upload.' }

  const text = await file.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'Uploaded file is not valid JSON.' }
  }
  const incoming = normalizeContentLocaleFileMap(parsed)
  for (const key of Object.keys(incoming)) {
    if (!isValidContentLocaleKey(key)) {
      return { error: `Invalid content key “${key}” in upload.` }
    }
  }

  const next =
    mode === 'merge'
      ? { ...(await readContentLocaleFile(locale, scope, ownerId)), ...incoming }
      : incoming
  await writeContentLocaleFile(locale, scope, ownerId, next)
  revalidatePath('/admin/localization')
  return {
    ok: true,
    message: mode === 'merge' ? 'Merged upload into locale file.' : 'Replaced locale file.',
    text: `${JSON.stringify(next, null, 2)}\n`,
  }
}

export async function uploadContentLocaleZipAction(
  _prev: ContentLocaleFilesActionState,
  formData: FormData,
): Promise<ContentLocaleFilesActionState> {
  const gate = await requireAdmin()
  if ('error' in gate) return { error: gate.error }

  const locale = normalizeLocaleCode(String(formData.get('locale') ?? ''))
  const file = formData.get('file')
  if (!isValidLocaleCode(locale)) return { error: 'Pick a target locale.' }
  if (!(file instanceof File)) return { error: 'Choose a zip to upload.' }

  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    return { error: 'Could not read zip.' }
  }

  let written = 0
  for (const [name, bytes] of Object.entries(entries)) {
    const normalized = name.replace(/\\/g, '/')
    const match = /(?:^|\/)(layouts|nav)\/([^/]+)\.json$/i.exec(normalized)
    if (!match) continue
    const scope = parseScope(match[1]!.toLowerCase())
    const ownerId = match[2]!
    if (!scope || !ownerId) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(strFromU8(bytes))
    } catch {
      return { error: `Invalid JSON in zip entry ${normalized}.` }
    }
    const map = normalizeContentLocaleFileMap(parsed)
    for (const key of Object.keys(map)) {
      if (!isValidContentLocaleKey(key)) {
        return { error: `Invalid key “${key}” in ${normalized}.` }
      }
    }
    await writeContentLocaleFile(locale, scope, ownerId, map)
    written += 1
  }

  if (written === 0) {
    return { error: 'Zip had no layouts/*.json or nav/*.json files.' }
  }
  invalidateContentLocaleCatalog(locale)
  revalidatePath('/admin/localization')
  return { ok: true, message: `Uploaded ${written} locale file(s) into ${locale}/.` }
}

export async function listContentLocaleEditorOptionsAction(): Promise<{
  locales: string[]
  filesByLocale: Record<string, { scope: ContentLocaleScope; ownerId: string; relativePath: string }[]>
  error?: string
}> {
  const gate = await requireAdmin()
  if ('error' in gate) return { locales: [], filesByLocale: {}, error: gate.error }
  const settings = await getLocalizationSettings()
  const locales = settings.localesEnabled.length
    ? settings.localesEnabled
    : [settings.defaultLocale]
  const filesByLocale: Record<
    string,
    { scope: ContentLocaleScope; ownerId: string; relativePath: string }[]
  > = {}
  for (const locale of locales) {
    filesByLocale[locale] = await listContentLocaleFiles(locale)
  }
  return { locales, filesByLocale }
}
