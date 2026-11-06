import type { EventRecord } from '../types'

/** Public path segment for an event (`slug` preferred, else `id`). */
export function eventPublicPathKey(event: Pick<EventRecord, 'id' | 'slug'>): string {
  const slug = (event.slug || '').trim()
  return slug || event.id
}
