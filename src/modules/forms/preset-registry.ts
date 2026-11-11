/**
 * Form preset registry — design-module-boundary §6 seam.
 *
 * Built-in presets live in `presets.ts`. Other modules (Events, …) call
 * `registerFormPreset` to attach `onSubmitted` (and optionally override seeds)
 * without a second builder. No Events/Hero capacity logic here — hooks only.
 *
 * Client-safe for meta/seed lookup; `onSubmitted` runs server-side after submit.
 */

import type {
  FormFieldDef,
  FormPresetId,
  FormSubmissionPayload,
} from './types'

/** Context passed to `onSubmitted` after a successful store + mailer plan. */
export type FormSubmittedContext = {
  presetId: string
  definitionId: string | null
  formKey: string
  submissionId: string
  userId: string | null
  payload: FormSubmissionPayload
}

/** Optional same-origin handoff after submit (e.g. paid ticket checkout). */
export type FormPresetOnSubmittedResult = {
  redirectUrl?: string
}

export type FormPresetOnSubmitted = (
  ctx: FormSubmittedContext,
) =>
  | void
  | FormPresetOnSubmittedResult
  | Promise<void | FormPresetOnSubmittedResult>

export type FormPresetMessages = {
  title: string
  successMessage: string
  submitLabel: string
  description: string
}

/**
 * Registration payload for `registerFormPreset`.
 * Prefer built-in `FormPresetId`s; custom string ids are reserved for later
 * module packs (still keyed for `onSubmitted` when a definition uses them).
 */
export type FormPresetRegistration = {
  id: FormPresetId | (string & {})
  label: string
  description?: string
  /** When set, replaces built-in seed fields for this id. */
  seedFields?: FormFieldDef[]
  /** Partial overlay on built-in / default messages. */
  messages?: Partial<FormPresetMessages>
  /**
   * Invoked after the submission row is stored (and email notify is attempted).
   * Soft-failed — must not block the public success response.
   */
  onSubmitted?: FormPresetOnSubmitted
}

type StoredRegistration = {
  id: string
  label: string
  description?: string
  seedFields?: FormFieldDef[]
  messages?: Partial<FormPresetMessages>
  onSubmitted?: FormPresetOnSubmitted
}

const registrations = new Map<string, StoredRegistration>()

/** Register or replace a form preset overlay (idempotent per id). */
export function registerFormPreset(reg: FormPresetRegistration): void {
  const id = typeof reg.id === 'string' ? reg.id.trim() : ''
  if (!id) throw new Error('registerFormPreset: id is required.')
  const label = typeof reg.label === 'string' ? reg.label.trim() : ''
  if (!label) throw new Error('registerFormPreset: label is required.')

  const next: StoredRegistration = { id, label }
  if (typeof reg.description === 'string' && reg.description.trim()) {
    next.description = reg.description.trim()
  }
  if (Array.isArray(reg.seedFields)) {
    next.seedFields = reg.seedFields
  }
  if (reg.messages && typeof reg.messages === 'object') {
    next.messages = { ...reg.messages }
  }
  if (typeof reg.onSubmitted === 'function') {
    next.onSubmitted = reg.onSubmitted
  }
  registrations.set(id, next)
}

/** Test / reset helper — clears module overlays. */
export function clearFormPresetRegistrations(): void {
  registrations.clear()
}

export function getRegisteredFormPreset(id: string): StoredRegistration | undefined {
  return registrations.get(id)
}

export function listRegisteredFormPresets(): StoredRegistration[] {
  return [...registrations.values()]
}

/**
 * Run `onSubmitted` for a preset id when registered.
 * Errors are swallowed by the caller (submit path) — this only invokes.
 */
export async function runFormPresetOnSubmitted(
  ctx: FormSubmittedContext,
): Promise<FormPresetOnSubmittedResult | void> {
  const hook = registrations.get(ctx.presetId)?.onSubmitted
  if (!hook) return
  return await hook(ctx)
}
