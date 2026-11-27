/**
 * Production wiring for inviteOnboardingPerson.
 * Creates the Core user via Better Auth, seeds a reset token, emits Email Manager
 * triggers, and records the account_invite mail log. Never calls getMailer().
 */

import 'server-only'

import { sql } from 'drizzle-orm'
import { randomBytes, randomUUID } from 'node:crypto'

import { auth } from '@/core/auth'
import { appOrigin } from '@/core/content/metadata'
import { db } from '@/core/db'
import { sfUsers, sfVerifications } from '@/core/db/schema'

import {
  inviteOnboardingPerson,
  type InviteDeps,
  type InviteResult,
} from './invite'
import { recordMailLog } from './procedure-store'
import type { InviteFieldInput } from './procedure-rules'
import { ensureSeededStatuses, getStatusByKey, writeIdentityFacts } from './store'
import type { OnboardingDoorResult } from './door'

async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null
  const rows = await db
    .select({ id: sfUsers.id })
    .from(sfUsers)
    .where(sql`lower(${sfUsers.email}) = ${normalized}`)
    .limit(1)
  const row = rows[0]
  return row ? { id: row.id } : null
}

async function createCoreUser(input: {
  name: string
  email: string
  password: string
}): Promise<{ id: string }> {
  const result = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  })
  const id = result.user?.id?.trim() || ''
  if (id) return { id }
  const again = await findUserByEmail(input.email)
  if (again) return again
  throw new Error('Could not create the Core user.')
}

/** Insert a Better Auth–compatible verification row and return the reset URL. */
async function createResetLink(email: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const id = randomUUID()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)
  await db.insert(sfVerifications).values({
    id,
    identifier: email.trim().toLowerCase(),
    value: token,
    expiresAt,
  })
  return `${appOrigin()}/reset-password?token=${encodeURIComponent(token)}`
}

function applicationFormLink(): string {
  return `${appOrigin()}/account`
}

async function emitOnboardingMail(input: {
  triggerKey: string
  payload: Record<string, unknown>
}): Promise<void> {
  try {
    const { emitEmailTrigger, isEmailManagerEnabled } = await import(
      '@/modules/email-manager/api.server'
    )
    if (!(await isEmailManagerEnabled())) return
    await emitEmailTrigger({
      triggerKey: input.triggerKey,
      payload: input.payload,
    })
  } catch (error) {
    console.error('[onboarding] emitEmailTrigger failed', error)
  }
}

export async function buildInviteDeps(opts: {
  isEnabled: boolean | (() => boolean | Promise<boolean>)
  senderUserId?: string
}): Promise<InviteDeps> {
  return {
    isEnabled: opts.isEnabled,
    senderUserId: opts.senderUserId,
    findUserByEmail,
    createUser: createCoreUser,
    getRecruitingStatusId: async () => {
      await ensureSeededStatuses()
      const recruiting = await getStatusByKey('recruiting')
      return recruiting?.id ?? ''
    },
    writeIdentity: async (userId, input) => {
      const result = await writeIdentityFacts(userId, {
        statusId: input.statusId,
        phone: input.phone ?? '',
      })
      if (!result.ok) return result
      return { ok: true }
    },
    createResetLink,
    applicationFormLink,
    emitMail: emitOnboardingMail,
    recordMailLog: async (input) => {
      await recordMailLog(input)
    },
  }
}

export async function invitePersonWithRuntime(
  input: InviteFieldInput,
  opts: {
    isEnabled: boolean | (() => boolean | Promise<boolean>)
    senderUserId?: string
  },
): Promise<OnboardingDoorResult<InviteResult>> {
  const deps = await buildInviteDeps(opts)
  return inviteOnboardingPerson(input, deps)
}
