'use client'

import React, { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'

import { getAdminOverlayPortalTarget } from '@/components/admin/useFloatingSettingsPanel'

import { buildOnboardingEmailTemplateEmbedUrl } from '../email-template-embed'

type Props = {
  open: boolean
  templateId: string
  onClose: () => void
}

/**
 * Onboarding Edit → Email Manager template editor in a dialog (`?embed=1`).
 * Empty template id does not open. Closing leaves the picker on the same id.
 */
export function EmailTemplateEditDialog({ open, templateId, onClose }: Props) {
  const titleId = useId()
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  const built = buildOnboardingEmailTemplateEmbedUrl(templateId)

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
        className="sf-admin-confirm-dialog sf-admin-form-dialog sf-onboarding-email-embed-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sf-admin-confirm-head sf-onboarding-email-embed-head">
          <h3 id={titleId}>Edit email template</h3>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <iframe
          className="sf-onboarding-email-embed-frame"
          src={built.url}
          title="Email Manager template editor"
        />
      </div>
    </div>,
    portalTarget,
  )
}

/** Edit control: opens the embed dialog when the stored template id is non-empty. */
export function EmailTemplateEditLink({
  templateId,
  emptyFallback = true,
}: {
  templateId: string
  /** When empty, link to Email Manager templates list (default). */
  emptyFallback?: boolean
}) {
  const [open, setOpen] = useState(false)
  const id = templateId.trim()
  const built = buildOnboardingEmailTemplateEmbedUrl(id)

  if (!built.ok) {
    if (!emptyFallback) return null
    return <Link href="/admin/email/templates">Open Email Manager</Link>
  }

  return (
    <>
      <button type="button" className="sf-onboarding-email-embed-edit" onClick={() => setOpen(true)}>
        Edit
      </button>
      <EmailTemplateEditDialog
        open={open}
        templateId={built.templateId}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
