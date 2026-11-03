/** Redirect status codes supported by product:redirects. */
export type RedirectStatusCode = 301 | 302

export type RedirectRecord = {
  id: string
  fromPath: string
  toUrl: string
  statusCode: RedirectStatusCode
  enabled: boolean
  note: string | null
  createdAt: Date
  updatedAt: Date
}

export type RedirectMatch = {
  to: string
  status: RedirectStatusCode
}

export type RedirectAdminActionState = {
  error?: string
  ok?: boolean
  message?: string
  redirectId?: string
}
