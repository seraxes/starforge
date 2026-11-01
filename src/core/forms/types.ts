/**
 * Core Form module types (SF-48).
 * Field definitions live on the layout slot config; submissions in `sf_form_submissions`.
 */

export type FormFieldType = 'text' | 'email' | 'textarea'

export type FormFieldDef = {
  /** Stable field name (HTML name attribute / payload key). */
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  placeholder?: string
}

/** Layout slot config for the `form` particle. */
export type FormParticleConfig = {
  /** Optional heading above the form. */
  heading?: string
  /** Fields (JSON). Minimum defaults: name, email, message. */
  fields?: FormFieldDef[]
  successMessage?: string
  submitLabel?: string
  /**
   * When true, use Site Chrome captchaEnabled + captchaProvider
   * (Turnstile keys from env). When false, skip captcha for this instance.
   */
  useSiteCaptchaDefault?: boolean
}

export type FormSubmissionRecord = {
  id: string
  formKey: string
  layoutId: string | null
  slotId: string | null
  payload: Record<string, string>
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export type FormSubmitActionState = {
  error?: string
  ok?: boolean
  message?: string
}
