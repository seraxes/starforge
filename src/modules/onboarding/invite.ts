/**
 * Invite orchestration — create Core user, place in recruiting, emit mail, log.
 * Injectable deps keep unit tests free of DB / Better Auth / Email Manager.
 * Never imports passwords from a legacy source; a one-time random password is
 * generated for Better Auth sign-up and never returned to the caller.
 */

import { randomBytes } from 'node:crypto'

import { runOnboardingDoor, type OnboardingDoorResult } from './door'
import {
  validateInviteFields,
  type InviteFieldInput,
  type InviteFieldValues,
} from './procedure-rules'

export const ONBOARDING_ACCOUNT_INVITE_TRIGGER = 'product:onboarding/account_invite'
export const ONBOARDING_APPLICATION_MAIL_TRIGGER = 'product:onboarding/application'

export type InviteMailEmit = {
  triggerKey: string
  payload: Record<string, unknown>
}

export type InviteMailLogInput = {
  userId: string
  channel: 'account_invite'
  subject: string
  body: string
  toEmail: string
  senderUserId: string
}

export type InviteCreateUserInput = {
  name: string
  email: string
  /** One-time random password for Better Auth — never logged or returned. */
  password: string
}

export type InviteDeps = {
  isEnabled: boolean | (() => boolean | Promise<boolean>)
  findUserByEmail: (email: string) => Promise<{ id: string } | null>
  createUser: (input: InviteCreateUserInput) => Promise<{ id: string }>
  getRecruitingStatusId: () => Promise<string>
  writeIdentity: (
    userId: string,
    input: { statusId: string; phone?: string },
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  createResetLink: (email: string) => Promise<string>
  applicationFormLink: () => string | Promise<string>
  emitMail: (input: InviteMailEmit) => Promise<void>
  recordMailLog: (input: InviteMailLogInput) => Promise<void>
  senderUserId?: string
  /** Override random password (tests only). */
  generatePassword?: () => string
}

export type InviteResult =
  | {
      ok: true
      userId: string
      email: string
      name: string
      statusId: string
    }
  | { ok: false; error: string }

function defaultPassword(): string {
  return `Tmp!${randomBytes(24).toString('base64url')}`
}

/**
 * Invite a person into Onboarding.
 * Off → `{ ok: false, reason: 'disabled' }` and never creates a user.
 */
export async function inviteOnboardingPerson(
  input: InviteFieldInput,
  deps: InviteDeps,
): Promise<OnboardingDoorResult<InviteResult>> {
  return runOnboardingDoor(deps.isEnabled, async () => {
    const parsed = validateInviteFields(input)
    if (!parsed.ok) return parsed

    return runInvite(parsed.values, deps)
  })
}

async function runInvite(
  values: InviteFieldValues,
  deps: InviteDeps,
): Promise<InviteResult> {
  const existing = await deps.findUserByEmail(values.email)
  if (existing) {
    return { ok: false, error: 'An account with that email already exists.' }
  }

  const recruitingStatusId = (await deps.getRecruitingStatusId()).trim()
  if (!recruitingStatusId) {
    return { ok: false, error: 'Recruiting status is not seeded.' }
  }

  const password = deps.generatePassword?.() ?? defaultPassword()
  let userId = ''
  try {
    const created = await deps.createUser({
      name: values.name,
      email: values.email,
      password,
    })
    userId = created.id.trim()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create the Core user.',
    }
  }
  if (!userId) return { ok: false, error: 'Could not create the Core user.' }

  const identity = await deps.writeIdentity(userId, {
    statusId: recruitingStatusId,
    phone: values.phone,
  })
  if (!identity.ok) {
    return { ok: false, error: identity.error }
  }

  const resetLink = await deps.createResetLink(values.email)
  const formLink = await deps.applicationFormLink()
  const senderUserId = (deps.senderUserId ?? '').trim()

  const inviteSubject = `Welcome — set your password`
  const inviteBody = [
    `Hi ${values.name},`,
    '',
    'Your account is ready. Set a password, then open the application form.',
    '',
    `Set password: ${resetLink}`,
    formLink ? `Application: ${formLink}` : null,
    '',
    '— Onboarding',
  ]
    .filter((line) => line != null)
    .join('\n')

  await deps.emitMail({
    triggerKey: ONBOARDING_ACCOUNT_INVITE_TRIGGER,
    payload: {
      name: values.name,
      email: values.email,
      resetLink,
      formLink,
      subject: inviteSubject,
      body: inviteBody,
    },
  })

  await deps.recordMailLog({
    userId,
    channel: 'account_invite',
    subject: inviteSubject,
    body: inviteBody,
    toEmail: values.email,
    senderUserId,
  })

  const applicationSubject = `Application form`
  const applicationBody = [
    `Hi ${values.name},`,
    '',
    'Please complete your application.',
    formLink ? `Form: ${formLink}` : 'Your recruiting status is ready in your account.',
    '',
    '— Onboarding',
  ].join('\n')

  await deps.emitMail({
    triggerKey: ONBOARDING_APPLICATION_MAIL_TRIGGER,
    payload: {
      name: values.name,
      email: values.email,
      formLink,
      subject: applicationSubject,
      body: applicationBody,
    },
  })

  return {
    ok: true,
    userId,
    email: values.email,
    name: values.name,
    statusId: recruitingStatusId,
  }
}
