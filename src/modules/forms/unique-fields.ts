/**
 * Unique reusable Form field templates (Profiles palette).
 * At most one instance of each `uniqueKey` may exist on a form — used items
 * leave the Fields list until removed from the canvas.
 *
 * Client-safe — no server-only imports.
 */

import type { FormFieldDef } from './types'

export type UniqueFormFieldCategoryId = 'profiles'

export type UniqueFormFieldTemplate = {
  uniqueKey: string
  category: UniqueFormFieldCategoryId
  /** Fixed HTML / payload name (slug). */
  name: string
  label: string
  hint: string
  /** Draft factory — always sets `uniqueKey` + stable `name`. */
  createDraft: () => FormFieldDef
}

const PROFILE_UNIQUE_PREFIX = 'profile:'

function profileUniqueKey(name: string): string {
  return `${PROFILE_UNIQUE_PREFIX}${name}`
}

function draft(
  partial: Omit<FormFieldDef, 'uniqueKey'> & { uniqueKey: string },
): FormFieldDef {
  return { ...partial }
}

/** Built-in Profile fields — same stable names as the protected `profile` preset. */
const PROFILE_TEMPLATES: UniqueFormFieldTemplate[] = [
  {
    uniqueKey: profileUniqueKey('display_name'),
    category: 'profiles',
    name: 'display_name',
    label: 'Display name',
    hint: 'Locked identity',
    createDraft: () =>
      draft({
        id: 'profile_display_name',
        uniqueKey: profileUniqueKey('display_name'),
        name: 'display_name',
        label: 'Display name',
        type: 'text',
        required: true,
        stringConstraints: { maxLength: 80 },
      }),
  },
  {
    uniqueKey: profileUniqueKey('handle'),
    category: 'profiles',
    name: 'handle',
    label: 'Username',
    hint: 'Public /u/handle',
    createDraft: () =>
      draft({
        id: 'profile_handle',
        uniqueKey: profileUniqueKey('handle'),
        name: 'handle',
        label: 'Username',
        type: 'text',
        required: true,
        description: 'Public address: /u/username.',
        stringConstraints: { minLength: 3, maxLength: 30 },
      }),
  },
  {
    uniqueKey: profileUniqueKey('headline'),
    category: 'profiles',
    name: 'headline',
    label: 'Headline',
    hint: 'Short line under name',
    createDraft: () =>
      draft({
        id: 'profile_headline',
        uniqueKey: profileUniqueKey('headline'),
        name: 'headline',
        label: 'Headline',
        type: 'text',
        required: false,
        placeholder: 'A short line under your name',
        stringConstraints: { maxLength: 120 },
      }),
  },
  {
    uniqueKey: profileUniqueKey('avatar'),
    category: 'profiles',
    name: 'avatar',
    label: 'Avatar',
    hint: 'Image + crop',
    createDraft: () =>
      draft({
        id: 'profile_avatar',
        uniqueKey: profileUniqueKey('avatar'),
        name: 'avatar',
        label: 'Avatar',
        type: 'text',
        required: true,
        description: 'Rendered as the profile image picker + crop (not a plain text input).',
      }),
  },
  {
    uniqueKey: profileUniqueKey('cover'),
    category: 'profiles',
    name: 'cover',
    label: 'Cover image',
    hint: 'Wide image + crop',
    createDraft: () =>
      draft({
        id: 'profile_cover',
        uniqueKey: profileUniqueKey('cover'),
        name: 'cover',
        label: 'Cover image',
        type: 'text',
        required: false,
        description: 'Rendered as the cover image picker + crop.',
      }),
  },
  {
    uniqueKey: profileUniqueKey('bio'),
    category: 'profiles',
    name: 'bio',
    label: 'Bio',
    hint: 'About textarea',
    createDraft: () =>
      draft({
        id: 'profile_bio',
        uniqueKey: profileUniqueKey('bio'),
        name: 'bio',
        label: 'Bio',
        type: 'textarea',
        required: false,
        placeholder: 'Tell the community about yourself…',
        stringConstraints: { maxLength: 2000 },
      }),
  },
  {
    uniqueKey: profileUniqueKey('birth_date'),
    category: 'profiles',
    name: 'birth_date',
    label: 'Date of birth',
    hint: 'Shown as age',
    createDraft: () =>
      draft({
        id: 'profile_birth_date',
        uniqueKey: profileUniqueKey('birth_date'),
        name: 'birth_date',
        label: 'Date of birth (shown as age)',
        type: 'date',
        required: false,
        description: 'Others only ever see age when allowed.',
      }),
  },
  {
    uniqueKey: profileUniqueKey('gender'),
    category: 'profiles',
    name: 'gender',
    label: 'Gender',
    hint: 'Select',
    createDraft: () =>
      draft({
        id: 'profile_gender',
        uniqueKey: profileUniqueKey('gender'),
        name: 'gender',
        label: 'Gender',
        type: 'select',
        required: false,
        options: [
          { value: '', label: 'Prefer not to say' },
          { value: 'female', label: 'Female' },
          { value: 'male', label: 'Male' },
          { value: 'nonbinary', label: 'Non-binary' },
        ],
      }),
  },
  {
    uniqueKey: profileUniqueKey('country'),
    category: 'profiles',
    name: 'country',
    label: 'Country',
    hint: 'Country select',
    createDraft: () =>
      draft({
        id: 'profile_country',
        uniqueKey: profileUniqueKey('country'),
        name: 'country',
        label: 'Country',
        type: 'text',
        required: false,
        description: 'Rendered as a country select in the profile editor.',
      }),
  },
  {
    uniqueKey: profileUniqueKey('city'),
    category: 'profiles',
    name: 'city',
    label: 'City',
    hint: 'City text',
    createDraft: () =>
      draft({
        id: 'profile_city',
        uniqueKey: profileUniqueKey('city'),
        name: 'city',
        label: 'City',
        type: 'text',
        required: false,
        stringConstraints: { maxLength: 80 },
      }),
  },
  {
    uniqueKey: profileUniqueKey('location'),
    category: 'profiles',
    name: 'location',
    label: 'Map location',
    hint: 'Approximate pin',
    createDraft: () =>
      draft({
        id: 'profile_location',
        uniqueKey: profileUniqueKey('location'),
        name: 'location',
        label: 'Map location (approximate)',
        type: 'text',
        required: false,
        description: 'Rendered as the map pin picker.',
      }),
  },
  {
    uniqueKey: profileUniqueKey('website'),
    category: 'profiles',
    name: 'website',
    label: 'Website',
    hint: 'URL',
    createDraft: () =>
      draft({
        id: 'profile_website',
        uniqueKey: profileUniqueKey('website'),
        name: 'website',
        label: 'Website',
        type: 'url',
        required: false,
        placeholder: 'https://',
      }),
  },
  {
    uniqueKey: profileUniqueKey('phone'),
    category: 'profiles',
    name: 'phone',
    label: 'Phone',
    hint: 'Telephone',
    createDraft: () =>
      draft({
        id: 'profile_phone',
        uniqueKey: profileUniqueKey('phone'),
        name: 'phone',
        label: 'Phone',
        type: 'tel',
        required: false,
        stringConstraints: { maxLength: 32 },
      }),
  },
  {
    uniqueKey: profileUniqueKey('links'),
    category: 'profiles',
    name: 'links',
    label: 'Social links',
    hint: 'Links repeater',
    createDraft: () =>
      draft({
        id: 'profile_links',
        uniqueKey: profileUniqueKey('links'),
        name: 'links',
        label: 'Social links',
        type: 'text',
        required: false,
        description: 'Rendered as the social links repeater.',
      }),
  },
  {
    uniqueKey: profileUniqueKey('locale'),
    category: 'profiles',
    name: 'locale',
    label: 'Language',
    hint: 'Private pref',
    createDraft: () =>
      draft({
        id: 'profile_locale',
        uniqueKey: profileUniqueKey('locale'),
        name: 'locale',
        label: 'Language',
        type: 'text',
        required: false,
        description: 'Private preference — only the member sees this.',
      }),
  },
  {
    uniqueKey: profileUniqueKey('timezone'),
    category: 'profiles',
    name: 'timezone',
    label: 'Time zone',
    hint: 'Private pref',
    createDraft: () =>
      draft({
        id: 'profile_timezone',
        uniqueKey: profileUniqueKey('timezone'),
        name: 'timezone',
        label: 'Time zone',
        type: 'text',
        required: false,
        placeholder: 'Europe/Budapest',
        description: 'Private preference — only the member sees this.',
      }),
  },
]

const BY_KEY = new Map(PROFILE_TEMPLATES.map((t) => [t.uniqueKey, t]))
const BY_NAME = new Map(PROFILE_TEMPLATES.map((t) => [t.name, t]))

export const UNIQUE_FORM_FIELD_CATEGORY_LABELS: Record<UniqueFormFieldCategoryId, string> = {
  profiles: 'Profile',
}

export function listUniqueFormFieldTemplates(
  category?: UniqueFormFieldCategoryId,
): UniqueFormFieldTemplate[] {
  if (!category) return [...PROFILE_TEMPLATES]
  return PROFILE_TEMPLATES.filter((t) => t.category === category)
}

export function getUniqueFormFieldTemplate(
  uniqueKey: string,
): UniqueFormFieldTemplate | undefined {
  return BY_KEY.get(uniqueKey)
}

export function uniqueFormFieldKeyForName(name: string): string | null {
  const slug = name.trim().toLowerCase()
  return BY_NAME.get(slug)?.uniqueKey ?? null
}

export function isUniqueFormFieldKey(value: unknown): value is string {
  return typeof value === 'string' && BY_KEY.has(value)
}

/** Resolve uniqueKey from explicit field value or known profile name. */
export function resolveFormFieldUniqueKey(field: Pick<FormFieldDef, 'name' | 'uniqueKey'>): string | null {
  if (typeof field.uniqueKey === 'string' && field.uniqueKey.trim()) {
    return field.uniqueKey.trim()
  }
  return uniqueFormFieldKeyForName(field.name)
}

/** Keys already placed on the form (by uniqueKey or reserved name). */
export function usedUniqueFormFieldKeys(fields: FormFieldDef[]): Set<string> {
  const used = new Set<string>()
  for (const field of fields) {
    const key = resolveFormFieldUniqueKey(field)
    if (key) used.add(key)
  }
  return used
}

/** Palette entries still available (not yet on the canvas). */
export function availableUniqueFormFieldTemplates(
  fields: FormFieldDef[],
  category?: UniqueFormFieldCategoryId,
): UniqueFormFieldTemplate[] {
  const used = usedUniqueFormFieldKeys(fields)
  return listUniqueFormFieldTemplates(category).filter((t) => !used.has(t.uniqueKey))
}

export function createUniqueFormFieldDraft(uniqueKey: string): FormFieldDef | null {
  const template = BY_KEY.get(uniqueKey)
  if (!template) return null
  return template.createDraft()
}
