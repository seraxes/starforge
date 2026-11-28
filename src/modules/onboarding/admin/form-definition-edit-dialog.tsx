'use client'

import React, { startTransition, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'

import { getAdminOverlayPortalTarget } from '@/components/admin/useFloatingSettingsPanel'

import {
  createOnboardingStatusFormAction,
  type OnboardingAdminActionState,
} from '../actions'
import { buildOnboardingFormDefinitionEmbedUrl } from '../form-definition-embed'

type DialogProps = {
  open: boolean
  formId: string
  onClose: () => void
}

/**
 * Onboarding Edit → Forms builder in a dialog (`?embed=1`).
 * Empty form id does not open. Closing leaves the picker on the same id.
 */
export function FormDefinitionEditDialog({ open, formId, onClose }: DialogProps) {
  const titleId = useId()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const built = buildOnboardingFormDefinitionEmbedUrl(formId)

  useEffect(() => {
    setPortalTarget(getAdminOverlayPortalTarget())
  }, [])

  useEffect(() => {
    if (!open || !built.ok) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, built.ok, onClose])

  if (!portalTarget || !open || !built.ok) return null

  return createPortal(
    <div
      className="sf-admin-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        className="sf-admin-confirm-dialog sf-admin-form-dialog sf-onboarding-form-embed-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sf-admin-confirm-head sf-onboarding-form-embed-head">
          <h3 id={titleId}>Edit form</h3>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <iframe
          className="sf-onboarding-form-embed-frame"
          src={built.url}
          title="Forms builder"
        />
      </div>
    </div>,
    portalTarget,
  )
}

/** Edit control: opens the embed dialog when the stored form id is non-empty. */
export function FormDefinitionEditLink({ formId }: { formId: string }) {
  const [open, setOpen] = useState(false)
  const id = formId.trim()
  const built = buildOnboardingFormDefinitionEmbedUrl(id)

  if (!built.ok) return null

  return (
    <>
      <button type="button" className="sf-onboarding-form-embed-edit" onClick={() => setOpen(true)}>
        Edit
      </button>
      <FormDefinitionEditDialog
        open={open}
        formId={built.formId}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

type CreateProps = {
  statusId: string
  statusName: string
  /** After create, update the status picker’s controlled value. */
  onCreated: (formId: string) => void
}

/**
 * Create a Forms definition for a status with no form, store the id, open the builder dialog.
 */
export function FormDefinitionCreateButton({ statusId, statusName, onCreated }: CreateProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [createdFormId, setCreatedFormId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function onCreate() {
    if (!statusId.trim() || pending) return
    setError(null)
    setPending(true)
    const fd = new FormData()
    fd.set('statusId', statusId)
    fd.set('statusName', statusName)
    startTransition(() => {
      void (async () => {
        let result: OnboardingAdminActionState
        try {
          result = await createOnboardingStatusFormAction({}, fd)
        } catch (err) {
          setPending(false)
          setError(err instanceof Error ? err.message : 'Could not create form.')
          return
        }
        setPending(false)
        if (result.error || !result.formId) {
          setError(result.error || 'Could not create form.')
          return
        }
        onCreated(result.formId)
        setCreatedFormId(result.formId)
        setOpen(true)
        router.refresh()
      })()
    })
  }

  return (
    <>
      <button
        type="button"
        className="sf-onboarding-form-embed-edit"
        disabled={pending || !statusId.trim()}
        onClick={onCreate}
      >
        {pending ? 'Creating…' : 'Create'}
      </button>
      {error ? (
        <span className="admin-inline-error" role="alert">
          {' '}
          {error}
        </span>
      ) : null}
      <FormDefinitionEditDialog
        open={open}
        formId={createdFormId}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
