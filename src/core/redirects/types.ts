/** Allowed redirect status codes (SEO + temporary). */
export const REDIRECT_STATUS_CODES = [301, 302, 307, 308] as const

export type RedirectStatusCode = (typeof REDIRECT_STATUS_CODES)[number]

export type RedirectRecord = {
  id: string
  fromPath: string
  toPath: string
  statusCode: RedirectStatusCode
  enabled: boolean
  note: string
  createdAt: Date
  updatedAt: Date
}

export type RedirectLookupHit = {
  to: string
  status: RedirectStatusCode
}

export type RedirectAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  redirectId?: string
}

export function isRedirectStatusCode(value: unknown): value is RedirectStatusCode {
  return (
    typeof value === 'number' &&
    (REDIRECT_STATUS_CODES as readonly number[]).includes(value)
  )
}
