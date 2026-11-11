import type { ContentLocaleOption } from '@/core/i18n/locale-text'

/** More than one public locale is enabled. Editors hide language controls otherwise. */
export function isMultilangEnabled(locales: Pick<ContentLocaleOption, 'code'>[]): boolean {
  return locales.length > 1
}
