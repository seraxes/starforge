import 'server-only'

import { getLocalizationSettings } from '@/core/localization/store'

import {
  buildChromeConsentKey,
  buildEventCategoryKey,
  buildLayoutSlotKey,
  buildNavItemKey,
  buildSubscriptionPlanKey,
  type ContentLocaleField,
} from '../content-locale-keys'
import { normalizeLocaleTextMap, type LocaleTextMap } from '../locale-text'
import { upsertContentLocaleValues } from './store'

export type SiteChromeConsentLocaleInput = {
  consentMessage: string
  consentPrivacyUrl: string
  consentPrivacyLinkLabel: string
  consentMessageLocales?: LocaleTextMap
  consentPrivacyUrlLocales?: LocaleTextMap
  consentPrivacyLinkLabelLocales?: LocaleTextMap
}

function collectMapEntries(
  map: LocaleTextMap | undefined,
  buildKey: () => string,
  into: Map<string, Record<string, string>>,
) {
  const normalized = normalizeLocaleTextMap(map)
  for (const [locale, value] of Object.entries(normalized)) {
    const key = buildKey()
    if (!key || !value.trim()) continue
    const bucket = into.get(locale) ?? {}
    bucket[key] = value
    into.set(locale, bucket)
  }
}

function collectScalar(
  locale: string,
  key: string,
  value: unknown,
  into: Map<string, Record<string, string>>,
) {
  if (typeof value !== 'string' || !value.trim()) return
  const bucket = into.get(locale) ?? {}
  bucket[key] = value.trim()
  into.set(locale, bucket)
}

/** Persist slot locale maps into language files; returns config without those maps. */
export async function syncLayoutSlotLocalesToFiles(input: {
  layoutId: string
  slotId: string
  config: Record<string, unknown>
}): Promise<Record<string, unknown>> {
  const { layoutId, slotId } = input
  const config = { ...input.config }
  const byLocale = new Map<string, Record<string, string>>()
  const settings = await getLocalizationSettings()
  const defaultLocale = settings.defaultLocale

  const scalarFields: ContentLocaleField[] = ['title', 'html', 'text', 'welcomeNote']
  for (const field of scalarFields) {
    const key = buildLayoutSlotKey({ layoutId, slotId, field })
    collectScalar(defaultLocale, key, config[field], byLocale)
    collectMapEntries(config[`${field}Locales`] as LocaleTextMap | undefined, () => key, byLocale)
    delete config[`${field}Locales`]
  }

  const items = Array.isArray(config.items) ? config.items : null
  if (items) {
    config.items = items.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
      const item = { ...(raw as Record<string, unknown>) }
      const itemId = typeof item.id === 'string' ? item.id : ''
      if (itemId) {
        const key = buildLayoutSlotKey({ layoutId, slotId, field: 'label', itemId })
        collectScalar(defaultLocale, key, item.label, byLocale)
        collectMapEntries(item.labelLocales as LocaleTextMap | undefined, () => key, byLocale)
      }
      delete item.labelLocales
      return item
    })
  }

  for (const [locale, entries] of byLocale) {
    await upsertContentLocaleValues(locale, entries)
  }
  return config
}

/** Persist nav item locale maps into language files; returns items without those maps. */
export async function syncNavItemLocalesToFiles(input: {
  menuId: string
  items: Array<Record<string, unknown>>
}): Promise<Array<Record<string, unknown>>> {
  const byLocale = new Map<string, Record<string, string>>()
  const settings = await getLocalizationSettings()
  const defaultLocale = settings.defaultLocale
  const next = input.items.map((raw) => {
    const item = { ...raw }
    const itemId = typeof item.id === 'string' ? item.id : ''
    if (itemId) {
      const labelKey = buildNavItemKey({ menuId: input.menuId, itemId, field: 'label' })
      const browserKey = buildNavItemKey({
        menuId: input.menuId,
        itemId,
        field: 'browserTitle',
      })
      const headingKey = buildNavItemKey({
        menuId: input.menuId,
        itemId,
        field: 'pageHeading',
      })
      collectScalar(defaultLocale, labelKey, item.label, byLocale)
      collectScalar(defaultLocale, browserKey, item.browserTitle, byLocale)
      collectScalar(defaultLocale, headingKey, item.pageHeading, byLocale)
      collectMapEntries(item.labels as LocaleTextMap | undefined, () => labelKey, byLocale)
      collectMapEntries(
        item.browserTitles as LocaleTextMap | undefined,
        () => browserKey,
        byLocale,
      )
      collectMapEntries(
        item.pageHeadings as LocaleTextMap | undefined,
        () => headingKey,
        byLocale,
      )
    }
    delete item.labels
    delete item.browserTitles
    delete item.pageHeadings
    return item
  })

  for (const [locale, entries] of byLocale) {
    await upsertContentLocaleValues(locale, entries)
  }
  return next
}

/**
 * Persist Site Chrome consent LocaleInput maps into language files.
 * Scalars stay on sf_site_chrome; *Locales are not stored on the document.
 */
export async function syncSiteChromeConsentLocalesToFiles(
  input: SiteChromeConsentLocaleInput,
): Promise<void> {
  const byLocale = new Map<string, Record<string, string>>()
  const settings = await getLocalizationSettings()
  const defaultLocale = settings.defaultLocale

  const messageKey = buildChromeConsentKey('message')
  const urlKey = buildChromeConsentKey('privacyUrl')
  const labelKey = buildChromeConsentKey('privacyLinkLabel')

  collectScalar(defaultLocale, messageKey, input.consentMessage, byLocale)
  collectScalar(defaultLocale, urlKey, input.consentPrivacyUrl, byLocale)
  collectScalar(defaultLocale, labelKey, input.consentPrivacyLinkLabel, byLocale)
  collectMapEntries(input.consentMessageLocales, () => messageKey, byLocale)
  collectMapEntries(input.consentPrivacyUrlLocales, () => urlKey, byLocale)
  collectMapEntries(input.consentPrivacyLinkLabelLocales, () => labelKey, byLocale)

  for (const [locale, entries] of byLocale) {
    await upsertContentLocaleValues(locale, entries)
  }
}

/**
 * Persist event category title / description into language files.
 * The default-locale scalars stay on `sf_event_categories`; locale maps do not.
 */
export async function syncEventCategoryLocalesToFiles(input: {
  categoryId: string
  title: string
  description: string
  titleLocales?: LocaleTextMap
  descriptionLocales?: LocaleTextMap
}): Promise<void> {
  const byLocale = new Map<string, Record<string, string>>()
  const settings = await getLocalizationSettings()
  const defaultLocale = settings.defaultLocale
  const titleKey = buildEventCategoryKey(input.categoryId, 'title')
  const textKey = buildEventCategoryKey(input.categoryId, 'text')

  collectScalar(defaultLocale, titleKey, input.title, byLocale)
  collectScalar(defaultLocale, textKey, input.description, byLocale)
  collectMapEntries(input.titleLocales, () => titleKey, byLocale)
  collectMapEntries(input.descriptionLocales, () => textKey, byLocale)

  for (const [locale, entries] of byLocale) {
    await upsertContentLocaleValues(locale, entries)
  }
}

/**
 * Persist subscription plan title / description into language files.
 * Default-locale scalars stay on `sf_sub_plans`; locale maps do not.
 */
export async function syncSubscriptionPlanLocalesToFiles(input: {
  planId: string
  title: string
  description: string
  titleLocales?: LocaleTextMap
  descriptionLocales?: LocaleTextMap
}): Promise<void> {
  const byLocale = new Map<string, Record<string, string>>()
  const settings = await getLocalizationSettings()
  const defaultLocale = settings.defaultLocale
  const titleKey = buildSubscriptionPlanKey(input.planId, 'title')
  const textKey = buildSubscriptionPlanKey(input.planId, 'text')

  collectScalar(defaultLocale, titleKey, input.title, byLocale)
  collectScalar(defaultLocale, textKey, input.description, byLocale)
  collectMapEntries(input.titleLocales, () => titleKey, byLocale)
  collectMapEntries(input.descriptionLocales, () => textKey, byLocale)

  for (const [locale, entries] of byLocale) {
    await upsertContentLocaleValues(locale, entries)
  }
}

/**
 * Build a LocaleTextMap for one key across locales (editor hydrate).
 * Includes empty string for missing locales so LocaleInput can switch freely.
 */
export async function hydrateLocaleMapForKey(
  key: string,
  locales: string[],
): Promise<LocaleTextMap> {
  const { loadContentLocaleCatalog, pickFromContentCatalog } = await import('./store')
  const out: LocaleTextMap = {}
  for (const locale of locales) {
    const catalog = await loadContentLocaleCatalog(locale)
    const value = pickFromContentCatalog(catalog, key)
    if (value) out[locale] = value
  }
  return out
}
