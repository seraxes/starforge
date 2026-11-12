/**
 * Content-locale maps for subscription plan title / description.
 */

import 'server-only'

import { buildSubscriptionPlanKey } from '@/core/i18n/content-locale-keys'
import { syncSubscriptionPlanLocalesToFiles } from '@/core/i18n/content-locales/sync'
import { readContentLocaleFile } from '@/core/i18n/content-locales/store'
import type { LocaleTextMap } from '@/core/i18n/locale-text'

export type SubscriptionPlanLocaleMaps = {
  titleLocales: LocaleTextMap
  descriptionLocales: LocaleTextMap
}

export async function loadSubscriptionPlanLocaleMaps(
  planId: string,
  locales: string[],
): Promise<SubscriptionPlanLocaleMaps> {
  const titleKey = buildSubscriptionPlanKey(planId, 'title')
  const textKey = buildSubscriptionPlanKey(planId, 'text')
  const titleLocales: LocaleTextMap = {}
  const descriptionLocales: LocaleTextMap = {}
  for (const locale of locales) {
    const file = await readContentLocaleFile(locale, 'subscriptions', planId)
    const title = file[titleKey]
    const description = file[textKey]
    if (title) titleLocales[locale] = title
    if (description) descriptionLocales[locale] = description
  }
  return { titleLocales, descriptionLocales }
}

export async function persistSubscriptionPlanLocales(input: {
  planId: string
  title: string
  description: string
  titleLocales?: LocaleTextMap
  descriptionLocales?: LocaleTextMap
}): Promise<void> {
  await syncSubscriptionPlanLocalesToFiles({
    planId: input.planId,
    title: input.title,
    description: input.description,
    titleLocales: input.titleLocales,
    descriptionLocales: input.descriptionLocales,
  })
}
