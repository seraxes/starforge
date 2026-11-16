import type { AdminAuditQuery } from '@/core/audit'

type Search = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? ''
  return value?.trim() ?? ''
}

export function auditQueryFromSearch(search: Search): AdminAuditQuery {
  return {
    limit: 200,
    action: first(search.action),
    targetType: first(search.targetType),
    actor: first(search.actor),
    from: first(search.from),
    to: first(search.to),
  }
}

export function auditFilterQuery(search: Search): string {
  const query = auditQueryFromSearch(search)
  const params = new URLSearchParams()
  if (query.action) params.set('action', query.action)
  if (query.targetType) params.set('targetType', query.targetType)
  if (query.actor) params.set('actor', query.actor)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)
  const text = params.toString()
  return text ? `?${text}` : ''
}
