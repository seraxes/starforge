import { GLOBAL_PAGE_CHROME_ID } from '@/core/db'

/** Prefix for outline-scoped Page Settings chrome rows in `sf_page_chrome`. */
export const OUTLINE_CHROME_ID_PREFIX = 'outline:'

/** Stable row id for a non-Base outline’s chrome overrides. */
export function outlineChromeRowId(outlineId: string): string {
  const id = outlineId.trim()
  if (!id) return `${OUTLINE_CHROME_ID_PREFIX}unknown`
  return `${OUTLINE_CHROME_ID_PREFIX}${id}`
}

export function isOutlineChromeRowId(id: string): boolean {
  return id.startsWith(OUTLINE_CHROME_ID_PREFIX)
}

export function outlineIdFromChromeRowId(id: string): string | null {
  if (!isOutlineChromeRowId(id)) return null
  const outlineId = id.slice(OUTLINE_CHROME_ID_PREFIX.length).trim()
  return outlineId || null
}

/** Whether this chrome row id is document chrome (global or outline), not a nav pageKey. */
export function isDocumentChromeRowId(id: string): boolean {
  return id === GLOBAL_PAGE_CHROME_ID || isOutlineChromeRowId(id)
}
