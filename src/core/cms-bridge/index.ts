/**
 * Global-admin → Payload CMS bridge.
 *
 * Product users stay in Better Auth (`sf_*`). Payload `users` remain CMS editors
 * only. For platform admins who need content access, seed / ensure creates a
 * *linked* Payload account with the same email (separate password cookie for
 * `/admin` — not a shared session). Payload stays a swappable content module.
 */
import { getPayload } from 'payload'

import config from '@payload-config'

/** Default local CMS bridge password (bootstrap admin uses the same for core + CMS). */
export const DEFAULT_CMS_BRIDGE_PASSWORD = 'starforge-admin'

/** Seed bootstrap admin email — same for core `/login` and Payload `/admin`. */
export const BOOTSTRAP_ADMIN_EMAIL = 'admin@starforge.local'

export type EnsureCmsUserInput = {
  email: string
  /** Defaults to `getCmsBridgePassword()`. */
  password?: string
  name?: string
}

export type EnsureCmsUserResult =
  | { ok: true; status: 'created'; email: string; id: number | string }
  | { ok: true; status: 'exists'; email: string; id: number | string }
  | { ok: false; error: string }

/**
 * Password used when auto-provisioning Payload CMS editors for global admins.
 * Override with `STARFORGE_CMS_BRIDGE_PASSWORD` for non-bootstrap admins
 * (STARFORGE_ADMIN_EMAILS) whose core password we do not know.
 */
export function getCmsBridgePassword(): string {
  const fromEnv = process.env.STARFORGE_CMS_BRIDGE_PASSWORD?.trim()
  if (fromEnv && fromEnv.length >= 8) return fromEnv
  return DEFAULT_CMS_BRIDGE_PASSWORD
}

export async function findPayloadCmsUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const payload = await getPayload({ config })
  const found = await payload.find({
    collection: 'users',
    where: { email: { equals: normalized } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return found.docs[0] ?? null
}

/**
 * Idempotent: create a Payload CMS editor for `email` if missing.
 * Does not overwrite an existing editor's password.
 */
export async function ensurePayloadCmsUser(
  input: EnsureCmsUserInput,
): Promise<EnsureCmsUserResult> {
  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'A valid email is required.' }
  }

  const password = (input.password ?? getCmsBridgePassword()).trim()
  if (password.length < 8) {
    return { ok: false, error: 'CMS bridge password must be at least 8 characters.' }
  }

  try {
    const existing = await findPayloadCmsUserByEmail(email)
    if (existing) {
      return { ok: true, status: 'exists', email, id: existing.id }
    }

    const payload = await getPayload({ config })
    const created = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        // Payload auth users use email as the primary identity; name is optional.
      },
      overrideAccess: true,
    })

    return { ok: true, status: 'created', email, id: created.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ensure CMS user.'
    return { ok: false, error: message }
  }
}

/** Ensure CMS editors for a list of admin emails (seed / bootstrap). */
export async function ensureCmsBridgeForEmails(
  emails: string[],
  password?: string,
): Promise<{ created: string[]; existing: string[]; failed: { email: string; error: string }[] }> {
  const created: string[] = []
  const existing: string[] = []
  const failed: { email: string; error: string }[] = []
  const pwd = password ?? getCmsBridgePassword()
  const seen = new Set<string>()

  for (const raw of emails) {
    const email = raw.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)

    const result = await ensurePayloadCmsUser({ email, password: pwd })
    if (!result.ok) {
      failed.push({ email, error: result.error })
      continue
    }
    if (result.status === 'created') created.push(email)
    else existing.push(email)
  }

  return { created, existing, failed }
}
