/**
 * Resolve rule audience → concrete To / Reply-To addresses.
 */

import { resolvePayloadPath } from './conditions'
import type { EmailAudience } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

export function splitEmailList(raw: string[] | undefined): string[] {
  if (!raw?.length) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    for (const part of String(entry)
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)) {
      if (!EMAIL_RE.test(part) || seen.has(part)) continue
      seen.add(part)
      out.push(part)
    }
  }
  return out
}

function emailsFromPayloadValue(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return splitEmailList(value.map((v) => String(v)))
  }
  if (typeof value === 'string') return splitEmailList([value])
  return []
}

export function normalizeEmailAudience(raw: unknown): EmailAudience {
  if (!raw || typeof raw !== 'object') return {}
  const rec = raw as Record<string, unknown>
  const audience: EmailAudience = {}
  if (Array.isArray(rec.to)) {
    audience.to = splitEmailList(rec.to.map(String))
  }
  if (Array.isArray(rec.toFromPayload)) {
    audience.toFromPayload = rec.toFromPayload
      .filter((p): p is string => typeof p === 'string')
      .map((p) => p.trim())
      .filter(Boolean)
  }
  if (Array.isArray(rec.cc)) {
    audience.cc = splitEmailList(rec.cc.map(String))
  }
  if (typeof rec.replyTo === 'string' && rec.replyTo.trim()) {
    audience.replyTo = rec.replyTo.trim()
  }
  if (typeof rec.replyToFromPayload === 'string' && rec.replyToFromPayload.trim()) {
    audience.replyToFromPayload = rec.replyToFromPayload.trim()
  }
  return audience
}

export function resolveEmailAudience(
  audience: EmailAudience,
  payload: Record<string, unknown>,
): { to: string[]; replyTo?: string } {
  const to = new Set<string>(splitEmailList(audience.to))
  for (const path of audience.toFromPayload || []) {
    for (const addr of emailsFromPayloadValue(resolvePayloadPath(payload, path))) {
      to.add(addr)
    }
  }

  let replyTo: string | undefined
  if (audience.replyTo && EMAIL_RE.test(audience.replyTo.trim())) {
    replyTo = audience.replyTo.trim().toLowerCase()
  } else if (audience.replyToFromPayload) {
    const fromPath = emailsFromPayloadValue(
      resolvePayloadPath(payload, audience.replyToFromPayload),
    )
    if (fromPath[0]) replyTo = fromPath[0]
  }

  return { to: [...to], replyTo }
}
