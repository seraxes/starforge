import { getRegisteredFormPreset, listRegisteredFormPresets } from './preset-registry'
import type { FormDefinitionDocument, FormFieldDef, FormPresetId } from './types'
import { listUniqueFormFieldTemplates } from './unique-fields'

/** Admin list grouping — module-owned presets land under their product category. */
export type FormPresetCategoryId =
  | 'general'
  | 'events'
  | 'support'
  | 'profiles'
  | 'subscriptions'

export const FORM_CATEGORY_LABELS: Record<FormPresetCategoryId, string> = {
  general: 'General',
  events: 'Events',
  support: 'Support',
  profiles: 'Profiles',
  subscriptions: 'Subscriptions',
}

/** Display order for Forms admin category sections. */
export const FORM_CATEGORY_ORDER: FormPresetCategoryId[] = [
  'events',
  'subscriptions',
  'profiles',
  'general',
  'support',
]

export function isFormPresetCategoryId(value: unknown): value is FormPresetCategoryId {
  return typeof value === 'string' && FORM_CATEGORY_ORDER.includes(value as FormPresetCategoryId)
}

export type FormPresetMeta = {
  id: FormPresetId
  label: string
  description: string
  category: FormPresetCategoryId
  /**
   * @deprecated Built-in presets are real seeds. Kept optional for older
   * verify scripts / overlays that may still mark experimental packs.
   */
  stub?: boolean
}

const BUILTIN_PRESETS: FormPresetMeta[] = [
  {
    id: 'contact',
    label: 'Contact',
    description: 'Name, email, message — default public contact form.',
    category: 'general',
  },
  {
    id: 'survey',
    label: 'Survey',
    description: 'Satisfaction survey — rating, topics, written feedback.',
    category: 'general',
  },
  {
    id: 'event-registration',
    label: 'Event registration',
    description:
      'Shared attendee signup used by product:events — edit fields here; Events injects event id / tiers / terms at render.',
    category: 'events',
  },
  {
    id: 'voting',
    label: 'Voting',
    description: 'Single-choice poll — radio options + optional comment.',
    category: 'general',
  },
  {
    id: 'ticket',
    label: 'Ticket / report',
    description:
      'Support ticket / report intake — subject, priority, category, details, optional attachment.',
    category: 'support',
  },
  {
    id: 'profile',
    label: 'Profile',
    description:
      'Member profile editor fields used by product:profiles — edit labels / order / required here; removing a field hides it (stored data is kept).',
    category: 'profiles',
  },
  {
    id: 'subscription-registration',
    label: 'Subscription registration',
    description:
      'Optional intake for product:subscriptions plans — edit fields here; Subscriptions links a plan to this definition and injects plan_id at checkout.',
    category: 'subscriptions',
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Empty form — add fields in the visual builder.',
    category: 'general',
  },
]

/** Category for a preset (unknown → general). */
export function categoryForPreset(preset: FormPresetId | string): FormPresetCategoryId {
  const meta = BUILTIN_PRESETS.find((p) => p.id === preset)
  return meta?.category ?? 'general'
}

/** Stable default Contact definition id (seeded when Forms first open). */
export const DEFAULT_CONTACT_FORM_ID = 'contact'

/** Stable shared Events registration definition id (seeded with Forms / Events). */
export const DEFAULT_EVENT_REGISTRATION_FORM_ID = 'event-registration'

/** Stable Profiles editor definition id (seeded with Forms / Profiles). */
export const DEFAULT_PROFILE_FORM_ID = 'profile'

/** Stable Subscriptions registration definition id (seeded with Forms / Subscriptions). */
export const DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID = 'subscription-registration'

/** Built-in definitions that must not be deleted from Forms admin. */
export function isProtectedFormDefinitionId(id: string): boolean {
  const trimmed = id.trim()
  return (
    trimmed === DEFAULT_CONTACT_FORM_ID ||
    trimmed === DEFAULT_EVENT_REGISTRATION_FORM_ID ||
    trimmed === DEFAULT_PROFILE_FORM_ID ||
    trimmed === DEFAULT_SUBSCRIPTION_REGISTRATION_FORM_ID
  )
}

/**
 * Built-in presets for Forms admin create-from-preset.
 * Registered overlays may adjust label/description via `registerFormPreset`.
 */
export const FORM_PRESETS: FormPresetMeta[] = BUILTIN_PRESETS

export function isFormPresetId(value: unknown): value is FormPresetId {
  return (
    typeof value === 'string' && BUILTIN_PRESETS.some((p) => p.id === value)
  )
}

export function getFormPresetMeta(id: FormPresetId): FormPresetMeta {
  const overlay = getRegisteredFormPreset(id)
  const base =
    BUILTIN_PRESETS.find((p) => p.id === id) ?? BUILTIN_PRESETS[BUILTIN_PRESETS.length - 1]!
  if (!overlay) return base
  return {
    ...base,
    label: overlay.label || base.label,
    description: overlay.description ?? base.description,
    category: base.category,
  }
}

/** Admin select list — built-ins with registry label/description overlays. */
export function listFormPresetMetas(): FormPresetMeta[] {
  const overlays = new Map(
    listRegisteredFormPresets().map((r) => [r.id, r] as const),
  )
  return BUILTIN_PRESETS.map((p) => {
    const overlay = overlays.get(p.id)
    if (!overlay) return p
    return {
      ...p,
      label: overlay.label || p.label,
      description: overlay.description ?? p.description,
    }
  })
}

/** Presets grouped for Forms admin create `<optgroup>` and list sections. */
export function listFormPresetsByCategory(): {
  category: FormPresetCategoryId
  label: string
  presets: FormPresetMeta[]
}[] {
  const metas = listFormPresetMetas()
  return FORM_CATEGORY_ORDER.map((category) => ({
    category,
    label: FORM_CATEGORY_LABELS[category],
    presets: metas.filter((p) => p.category === category),
  })).filter((group) => group.presets.length > 0)
}

function contactFields(): FormFieldDef[] {
  return [
    {
      id: 'fld_name',
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      placeholder: '',
      stringConstraints: { maxLength: 120 },
    },
    {
      id: 'fld_email',
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
      placeholder: '',
    },
    {
      id: 'fld_message',
      name: 'message',
      label: 'Message',
      type: 'textarea',
      required: true,
      placeholder: '',
      stringConstraints: { minLength: 3, maxLength: 5000 },
    },
  ]
}

function surveyFields(): FormFieldDef[] {
  return [
    {
      id: 'survey_name',
      name: 'name',
      label: 'Name',
      type: 'text',
      required: false,
      stringConstraints: { maxLength: 120 },
    },
    {
      id: 'survey_email',
      name: 'email',
      label: 'Email (optional)',
      type: 'email',
      required: false,
    },
    {
      id: 'survey_rating',
      name: 'rating',
      label: 'Overall satisfaction',
      type: 'radio',
      required: true,
      options: [
        { value: '5', label: 'Excellent' },
        { value: '4', label: 'Good' },
        { value: '3', label: 'Okay' },
        { value: '2', label: 'Poor' },
        { value: '1', label: 'Bad' },
      ],
    },
    {
      id: 'survey_topics',
      name: 'topics',
      label: 'Topics (optional)',
      type: 'checkbox-group',
      required: false,
      options: [
        { value: 'product', label: 'Product' },
        { value: 'support', label: 'Support' },
        { value: 'content', label: 'Content' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      id: 'survey_feedback',
      name: 'feedback',
      label: 'Feedback',
      type: 'textarea',
      required: true,
      placeholder: 'What worked well? What could improve?',
      stringConstraints: { minLength: 5, maxLength: 5000 },
    },
  ]
}

function eventRegistrationFields(): FormFieldDef[] {
  return [
    {
      id: 'event_name',
      name: 'name',
      label: 'Full name',
      type: 'text',
      required: true,
      stringConstraints: { maxLength: 120 },
    },
    {
      id: 'event_email',
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      id: 'event_phone',
      name: 'phone',
      label: 'Phone (optional)',
      type: 'tel',
      required: false,
      stringConstraints: { maxLength: 40 },
    },
    {
      id: 'event_guests',
      name: 'guests',
      label: 'Guests (including you)',
      type: 'number',
      required: true,
      defaultValue: '1',
      numberBounds: { min: 1, max: 20 },
    },
    {
      id: 'event_attendance',
      name: 'attendance',
      label: 'Attendance',
      type: 'select',
      required: true,
      defaultValue: 'in_person',
      options: [
        { value: 'in_person', label: 'In person' },
        { value: 'online', label: 'Online' },
      ],
    },
    {
      id: 'event_notes',
      name: 'notes',
      label: 'Notes (optional)',
      type: 'textarea',
      required: false,
      placeholder: 'Dietary needs, accessibility, questions…',
      stringConstraints: { maxLength: 2000 },
    },
    {
      id: 'event_id',
      name: 'event_id',
      label: 'Event id',
      type: 'hidden',
      required: false,
      defaultValue: '',
      description: 'Filled by Events / layout when bound to a specific event.',
    },
  ]
}

function votingFields(): FormFieldDef[] {
  return [
    {
      id: 'vote_choice',
      name: 'choice',
      label: 'Your choice',
      type: 'radio',
      required: true,
      options: [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' },
        { value: 'c', label: 'Option C' },
      ],
    },
    {
      id: 'vote_email',
      name: 'email',
      label: 'Email (optional)',
      type: 'email',
      required: false,
    },
    {
      id: 'vote_comment',
      name: 'comment',
      label: 'Comment (optional)',
      type: 'textarea',
      required: false,
      stringConstraints: { maxLength: 2000 },
    },
    {
      id: 'vote_poll_id',
      name: 'poll_id',
      label: 'Poll id',
      type: 'hidden',
      required: false,
      defaultValue: '',
      description: 'Filled when the Form is bound to a specific poll.',
    },
  ]
}

/**
 * Member profile editor fields (product:profiles).
 * Stable `name`s + `uniqueKey`s from the unique-fields catalog so the Forms
 * Profile palette can add/remove them (one of each per form).
 */
function profileFields(): FormFieldDef[] {
  return listUniqueFormFieldTemplates('profiles').map((t) => t.createDraft())
}

function subscriptionRegistrationFields(): FormFieldDef[] {
  return [
    {
      id: 'sub_name',
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
      stringConstraints: { maxLength: 120 },
    },
    {
      id: 'sub_email',
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      id: 'sub_company',
      name: 'company',
      label: 'Company / organization',
      type: 'text',
      required: false,
      stringConstraints: { maxLength: 160 },
    },
    {
      id: 'sub_notes',
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      required: false,
      stringConstraints: { maxLength: 2000 },
    },
  ]
}

function builtinFieldsForPreset(preset: FormPresetId): FormFieldDef[] {
  switch (preset) {
    case 'contact':
      return contactFields()
    case 'survey':
      return surveyFields()
    case 'event-registration':
      return eventRegistrationFields()
    case 'voting':
      return votingFields()
    case 'profile':
      return profileFields()
    case 'subscription-registration':
      return subscriptionRegistrationFields()
    case 'ticket':
      return [
        {
          id: 'ticket_name',
          name: 'name',
          label: 'Your name',
          type: 'text',
          required: true,
          stringConstraints: { maxLength: 120 },
        },
        {
          id: 'ticket_email',
          name: 'email',
          label: 'Email',
          type: 'email',
          required: true,
        },
        {
          id: 'ticket_subject',
          name: 'subject',
          label: 'Subject',
          type: 'text',
          required: true,
          stringConstraints: { minLength: 3, maxLength: 160 },
        },
        {
          id: 'ticket_priority',
          name: 'priority',
          label: 'Priority',
          type: 'select',
          required: true,
          defaultValue: 'normal',
          options: [
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
            { value: 'urgent', label: 'Urgent' },
          ],
        },
        {
          id: 'ticket_category',
          name: 'category',
          label: 'Category',
          type: 'select',
          required: true,
          options: [
            { value: 'bug', label: 'Bug / defect' },
            { value: 'access', label: 'Access / account' },
            { value: 'content', label: 'Content / pages' },
            { value: 'other', label: 'Other' },
          ],
        },
        {
          id: 'ticket_details',
          name: 'details',
          label: 'Details',
          type: 'textarea',
          required: true,
          placeholder: 'What happened? Steps to reproduce, expected vs actual…',
          stringConstraints: { minLength: 10, maxLength: 5000 },
        },
        {
          id: 'ticket_attachment',
          name: 'attachment',
          label: 'Attachment (optional)',
          type: 'file',
          required: false,
          upload: {
            accept: 'image/png,image/jpeg,image/webp,application/pdf',
            maxSizeBytes: 5 * 1024 * 1024,
          },
        },
      ]
    case 'blank':
    default:
      return []
  }
}

export function fieldsForPreset(preset: FormPresetId): FormFieldDef[] {
  const overlay = getRegisteredFormPreset(preset)
  if (overlay?.seedFields) {
    return overlay.seedFields.map((f) => ({ ...f }))
  }
  return builtinFieldsForPreset(preset)
}

export function defaultMessagesForPreset(preset: FormPresetId): {
  title: string
  successMessage: string
  submitLabel: string
  description: string
} {
  let base: {
    title: string
    successMessage: string
    submitLabel: string
    description: string
  }
  switch (preset) {
    case 'contact':
      base = {
        title: 'Contact',
        successMessage: 'Thanks — your message was sent.',
        submitLabel: 'Send',
        description: 'Public contact form.',
      }
      break
    case 'survey':
      base = {
        title: 'Survey',
        successMessage: 'Thanks for your feedback.',
        submitLabel: 'Submit survey',
        description: 'Satisfaction survey.',
      }
      break
    case 'event-registration':
      base = {
        title: 'Event registration',
        successMessage: 'You are registered.',
        submitLabel: 'Register',
        description: 'Event attendee registration.',
      }
      break
    case 'voting':
      base = {
        title: 'Vote',
        successMessage: 'Your vote was recorded.',
        submitLabel: 'Cast vote',
        description: 'Single-choice poll.',
      }
      break
    case 'ticket':
      base = {
        title: 'Report an issue',
        successMessage: 'Ticket received — we will follow up by email.',
        submitLabel: 'Submit ticket',
        description: 'Support ticket / report intake.',
      }
      break
    case 'profile':
      base = {
        title: 'Profile',
        successMessage: 'Profile saved.',
        submitLabel: 'Save',
        description:
          'Member profile fields. Managed in Forms; product:profiles renders the editor and stores values on sf_profiles.',
      }
      break
    case 'subscription-registration':
      base = {
        title: 'Subscription registration',
        successMessage: 'Thanks — your details were saved.',
        submitLabel: 'Continue',
        description:
          'Optional intake for product:subscriptions. Edit fields in Forms; plans link a definition id.',
      }
      break
    case 'blank':
    default:
      base = {
        title: 'Untitled form',
        successMessage: 'Thanks — your response was saved.',
        submitLabel: 'Submit',
        description: '',
      }
  }

  const overlay = getRegisteredFormPreset(preset)?.messages
  if (!overlay) return base
  return {
    title: overlay.title?.trim() || base.title,
    successMessage: overlay.successMessage?.trim() || base.successMessage,
    submitLabel: overlay.submitLabel?.trim() || base.submitLabel,
    description:
      overlay.description !== undefined ? String(overlay.description) : base.description,
  }
}

/** Build a definition document seed from a preset (schema filled by caller via fieldsToJsonSchema). */
export function presetSeedFields(preset: FormPresetId): {
  preset: FormPresetId
  fields: FormFieldDef[]
  meta: ReturnType<typeof defaultMessagesForPreset>
} {
  return {
    preset,
    fields: fieldsForPreset(preset),
    meta: defaultMessagesForPreset(preset),
  }
}

export type { FormDefinitionDocument }
