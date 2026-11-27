/**
 * Pure procedure / outcome / mail-channel rules.
 * Store and invite call these; unit tests hit this module without DB.
 */

export const ONBOARDING_EVENT_KINDS = [
  'ridealong',
  'trialday',
  'testday',
  'trainingday',
] as const

export type OnboardingEventKind = (typeof ONBOARDING_EVENT_KINDS)[number]

export const ONBOARDING_MEETING_MODES = ['onsite', 'online'] as const
export type OnboardingMeetingMode = (typeof ONBOARDING_MEETING_MODES)[number]

export const ONBOARDING_MAIL_CHANNELS = [
  'account_invite',
  'status_reminder',
  'event_ridealong',
  'event_trialday',
  'event_testday',
] as const

export type OnboardingMailChannel = (typeof ONBOARDING_MAIL_CHANNELS)[number]

/** Outcomes allowed per kind. email_sent on ridealong / trialday / testday. */
const OUTCOMES_BY_KIND: Record<OnboardingEventKind, readonly string[]> = {
  ridealong: ['email_sent', 'completed', 'no_show'],
  trialday: ['email_sent', 'passed', 'failed', 'no_show'],
  testday: ['email_sent', 'passed', 'failed', 'no_show'],
  trainingday: ['email_sent'],
}

export function isOnboardingEventKind(value: unknown): value is OnboardingEventKind {
  return (
    typeof value === 'string' &&
    (ONBOARDING_EVENT_KINDS as readonly string[]).includes(value)
  )
}

export function isOnboardingMeetingMode(value: unknown): value is OnboardingMeetingMode {
  return (
    typeof value === 'string' &&
    (ONBOARDING_MEETING_MODES as readonly string[]).includes(value)
  )
}

export function isOnboardingMailChannel(value: unknown): value is OnboardingMailChannel {
  return (
    typeof value === 'string' &&
    (ONBOARDING_MAIL_CHANNELS as readonly string[]).includes(value)
  )
}

export function outcomesForEventKind(kind: OnboardingEventKind): readonly string[] {
  return OUTCOMES_BY_KIND[kind]
}

export function isOutcomeAllowedForKind(kind: OnboardingEventKind, outcome: string): boolean {
  const trimmed = outcome.trim()
  if (!trimmed) return false
  return outcomesForEventKind(kind).includes(trimmed)
}

/**
 * Applying an event outcome never changes the person’s main status id.
 * Pure helper so tests can assert the contract without a DB.
 */
export function statusIdAfterEventOutcome(statusId: string, _outcome: string): string {
  return statusId
}

export type EventFieldInput = {
  kind?: unknown
  location?: unknown
  address?: unknown
  eventDate?: unknown
  eventTime?: unknown
  courierName?: unknown
  courierPhone?: unknown
  meetingMode?: unknown
  examUrl?: unknown
  applicantResponse?: unknown
  alsoTrial?: unknown
  requestedDates?: unknown
  requestedSubmissionId?: unknown
  dueNotice?: unknown
}

export type EventFieldValues = {
  kind: OnboardingEventKind
  location: string
  address: string
  eventDate: string
  eventTime: string
  courierName: string
  courierPhone: string
  meetingMode: OnboardingMeetingMode
  examUrl: string
  applicantResponse: string
  alsoTrial: boolean
  requestedDates: string[]
  requestedSubmissionId: string
  dueNotice: boolean
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? '').trim()
}

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n,]/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return []
}

export function validateEventFields(
  input: EventFieldInput,
  defaults?: Partial<EventFieldValues>,
): { ok: true; values: EventFieldValues } | { ok: false; error: string } {
  const kindRaw = asTrimmed(input.kind ?? defaults?.kind ?? '')
  if (!isOnboardingEventKind(kindRaw)) {
    return { ok: false, error: 'Event kind is required (ridealong, trialday, testday, or trainingday).' }
  }

  const meetingRaw = asTrimmed(input.meetingMode ?? defaults?.meetingMode ?? 'onsite') || 'onsite'
  if (!isOnboardingMeetingMode(meetingRaw)) {
    return { ok: false, error: 'Meeting mode must be onsite or online.' }
  }

  const applicantResponse = asTrimmed(
    input.applicantResponse ?? defaults?.applicantResponse ?? '',
  )
  if (applicantResponse && applicantResponse !== 'attending') {
    return { ok: false, error: 'Applicant response must be blank or attending.' }
  }

  const alsoTrial =
    typeof input.alsoTrial === 'boolean'
      ? input.alsoTrial
      : input.alsoTrial === '1' || input.alsoTrial === 1
        ? true
        : input.alsoTrial === '0' || input.alsoTrial === 0 || input.alsoTrial === ''
          ? false
          : defaults?.alsoTrial === true

  const dueNotice =
    typeof input.dueNotice === 'boolean'
      ? input.dueNotice
      : input.dueNotice === '1' || input.dueNotice === 1
        ? true
        : input.dueNotice === '0' || input.dueNotice === 0 || input.dueNotice === ''
          ? false
          : defaults?.dueNotice === true

  return {
    ok: true,
    values: {
      kind: kindRaw,
      location: asTrimmed(input.location ?? defaults?.location ?? ''),
      address: asTrimmed(input.address ?? defaults?.address ?? ''),
      eventDate: asTrimmed(input.eventDate ?? defaults?.eventDate ?? ''),
      eventTime: asTrimmed(input.eventTime ?? defaults?.eventTime ?? ''),
      courierName: asTrimmed(input.courierName ?? defaults?.courierName ?? ''),
      courierPhone: asTrimmed(input.courierPhone ?? defaults?.courierPhone ?? ''),
      meetingMode: meetingRaw,
      examUrl: asTrimmed(input.examUrl ?? defaults?.examUrl ?? ''),
      applicantResponse,
      alsoTrial,
      requestedDates:
        input.requestedDates !== undefined
          ? asStringList(input.requestedDates)
          : (defaults?.requestedDates ?? []),
      requestedSubmissionId: asTrimmed(
        input.requestedSubmissionId ?? defaults?.requestedSubmissionId ?? '',
      ),
      dueNotice,
    },
  }
}

export type InviteFieldInput = {
  name?: unknown
  email?: unknown
  phone?: unknown
}

export type InviteFieldValues = {
  name: string
  email: string
  phone: string
}

export function validateInviteFields(
  input: InviteFieldInput,
): { ok: true; values: InviteFieldValues } | { ok: false; error: string } {
  const name = asTrimmed(input.name)
  const email = asTrimmed(input.email).toLowerCase()
  const phone = asTrimmed(input.phone)
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!email || !email.includes('@')) return { ok: false, error: 'A valid email is required.' }
  return { ok: true, values: { name, email, phone } }
}
