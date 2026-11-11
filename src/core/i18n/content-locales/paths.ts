import path from 'node:path'

import { projectRoot } from '@/core/skin/pack-paths'

import { sanitizeContentLocaleId } from '../content-locale-keys'

export type ContentLocaleScope = 'layouts' | 'nav' | 'chrome'

export const CONTENT_LOCALE_SCOPES: readonly ContentLocaleScope[] = [
  'layouts',
  'nav',
  'chrome',
] as const

export function getContentLocalesRoot(): string {
  return path.join(projectRoot(), 'data', 'content-locales')
}

export function getContentLocaleDir(locale: string): string {
  const code = sanitizeContentLocaleId(locale) || 'en'
  return path.join(getContentLocalesRoot(), code)
}

export function getContentLocaleScopeDir(locale: string, scope: ContentLocaleScope): string {
  return path.join(getContentLocaleDir(locale), scope)
}

export function getContentLocaleFilePath(
  locale: string,
  scope: ContentLocaleScope,
  ownerId: string,
): string {
  const id = sanitizeContentLocaleId(ownerId) || 'untitled'
  return path.join(getContentLocaleScopeDir(locale, scope), `${id}.json`)
}
