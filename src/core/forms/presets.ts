import type { FormDefinitionDocument, FormFieldDef, FormPresetId } from './types'

export type FormPresetMeta = {
  id: FormPresetId
  label: string
  description: string
  /** Foundation stub — only contact ships a full field set. */
  stub?: boolean
}

export const FORM_PRESETS: FormPresetMeta[] = [
  {
    id: 'contact',
    label: 'Contact',
    description: 'Name, email, message — default public contact form.',
  },
  {
    id: 'survey',
    label: 'Survey',
    description: 'Opinion / feedback survey (stub — reuse Form engine fields).',
    stub: true,
  },
  {
    id: 'event-registration',
    label: 'Event registration',
    description: 'Event signup fields (stub — ASN/events layer later).',
    stub: true,
  },
  {
    id: 'voting',
    label: 'Voting',
    description: 'Poll / vote intake (stub — workflow layer later).',
    stub: true,
  },
  {
    id: 'ticket',
    label: 'Ticket / report',
    description: 'Support ticket or report intake (stub).',
    stub: true,
  },
  {
    id: 'blank',
    label: 'Blank',
    description: 'Empty form — add fields in the visual builder.',
  },
]

export function isFormPresetId(value: unknown): value is FormPresetId {
  return (
    typeof value === 'string' && FORM_PRESETS.some((p) => p.id === value)
  )
}

export function getFormPresetMeta(id: FormPresetId): FormPresetMeta {
  return FORM_PRESETS.find((p) => p.id === id) ?? FORM_PRESETS[FORM_PRESETS.length - 1]!
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
    },
  ]
}

/** Stub presets start from a thin contact-like core so the engine is usable today. */
function stubCoreFields(prefix: string): FormFieldDef[] {
  return [
    {
      id: `${prefix}_name`,
      name: 'name',
      label: 'Name',
      type: 'text',
      required: true,
    },
    {
      id: `${prefix}_email`,
      name: 'email',
      label: 'Email',
      type: 'email',
      required: true,
    },
    {
      id: `${prefix}_notes`,
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      required: false,
    },
  ]
}

export function fieldsForPreset(preset: FormPresetId): FormFieldDef[] {
  switch (preset) {
    case 'contact':
      return contactFields()
    case 'survey':
      return [
        ...stubCoreFields('survey'),
        {
          id: 'survey_rating',
          name: 'rating',
          label: 'Rating',
          type: 'select',
          required: true,
          options: [
            { value: '5', label: 'Excellent' },
            { value: '4', label: 'Good' },
            { value: '3', label: 'Okay' },
            { value: '2', label: 'Poor' },
            { value: '1', label: 'Bad' },
          ],
        },
      ]
    case 'event-registration':
      return [
        ...stubCoreFields('event'),
        {
          id: 'event_guests',
          name: 'guests',
          label: 'Guests',
          type: 'number',
          required: false,
          placeholder: '1',
        },
      ]
    case 'voting':
      return [
        {
          id: 'vote_choice',
          name: 'choice',
          label: 'Choice',
          type: 'select',
          required: true,
          options: [
            { value: 'a', label: 'Option A' },
            { value: 'b', label: 'Option B' },
            { value: 'c', label: 'Option C' },
          ],
        },
        {
          id: 'vote_comment',
          name: 'comment',
          label: 'Comment',
          type: 'textarea',
          required: false,
        },
      ]
    case 'ticket':
      return [
        ...stubCoreFields('ticket'),
        {
          id: 'ticket_subject',
          name: 'subject',
          label: 'Subject',
          type: 'text',
          required: true,
        },
      ]
    case 'blank':
    default:
      return []
  }
}

export function defaultMessagesForPreset(preset: FormPresetId): {
  title: string
  successMessage: string
  submitLabel: string
  description: string
} {
  switch (preset) {
    case 'contact':
      return {
        title: 'Contact',
        successMessage: 'Thanks — your message was sent.',
        submitLabel: 'Send',
        description: 'Public contact form.',
      }
    case 'survey':
      return {
        title: 'Survey',
        successMessage: 'Thanks for your feedback.',
        submitLabel: 'Submit',
        description: 'Survey preset (stub).',
      }
    case 'event-registration':
      return {
        title: 'Event registration',
        successMessage: 'You are registered.',
        submitLabel: 'Register',
        description: 'Event registration preset (stub).',
      }
    case 'voting':
      return {
        title: 'Vote',
        successMessage: 'Your vote was recorded.',
        submitLabel: 'Vote',
        description: 'Voting preset (stub).',
      }
    case 'ticket':
      return {
        title: 'Report an issue',
        successMessage: 'Ticket received — we will follow up.',
        submitLabel: 'Submit ticket',
        description: 'Ticket / report preset (stub).',
      }
    case 'blank':
    default:
      return {
        title: 'Untitled form',
        successMessage: 'Thanks — your response was saved.',
        submitLabel: 'Submit',
        description: '',
      }
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

/** Stable default Contact definition id (seeded when Forms first open). */
export const DEFAULT_CONTACT_FORM_ID = 'contact'

export type { FormDefinitionDocument }
