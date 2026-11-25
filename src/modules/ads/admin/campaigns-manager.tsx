'use client'

import React, { startTransition, useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import { MediaPicker } from '@/modules/media/api'

import {
  createCampaignAction,
  deleteCampaignAction,
  updateCampaignAction,
  type AdsActionState,
} from '../actions'
import type { AdsCampaignRecord, AdsPackageRecord, AdsPlacementRecord } from '../types'
import { CAMPAIGN_STATUSES } from '../types'

const initial: AdsActionState = {}

type Props = {
  campaigns: AdsCampaignRecord[]
  packages: AdsPackageRecord[]
  placements: AdsPlacementRecord[]
  mediaEnabled: boolean
}

function Feedback({ state }: { state: AdsActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok) {
    return (
      <p className="admin-inline-ok" role="status">
        Saved.
      </p>
    )
  }
  return null
}

function toLocalInputValue(value: Date | string | null | undefined): string {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function CampaignFields({
  row,
  packages,
  placements,
  pending,
  mediaEnabled,
}: {
  row?: AdsCampaignRecord
  packages: AdsPackageRecord[]
  placements: AdsPlacementRecord[]
  pending: boolean
  mediaEnabled: boolean
}) {
  const [creativeMediaId, setCreativeMediaId] = useState(row?.creativeMediaId ?? '')
  const selectedPlacements = new Set(row?.placementIds ?? [])
  const statusChoices = CAMPAIGN_STATUSES.filter((s) => s !== 'live')

  return (
    <fieldset className="settings-fieldset sf-events-form-section">
      <legend>Campaign</legend>
      <div className="sf-ads-campaign-fields">
        <label className="settings-field">
          <span>Buyer user id</span>
          <input
            type="text"
            name="buyerUserId"
            defaultValue={row?.buyerUserId ?? ''}
            disabled={pending}
            autoComplete="off"
          />
        </label>
        <label className="settings-field">
          <span>Package</span>
          <select
            name="packageId"
            defaultValue={row?.packageId ?? ''}
            required
            disabled={pending || packages.length === 0}
          >
            <option value="">Select a package…</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.title}
                {pkg.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-field">
          <span>Placements</span>
          {placements.length === 0 ? (
            <span className="settings-hint">Create a placement first.</span>
          ) : (
            <div className="sf-ads-placement-checks">
              {placements.map((p) => (
                <label key={p.id} className="settings-field settings-flag">
                  <span>
                    {p.label} ({p.key})
                  </span>
                  <input
                    type="checkbox"
                    name="placementIds"
                    value={p.id}
                    defaultChecked={selectedPlacements.has(p.id)}
                    disabled={pending || !p.enabled}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
        <label className="settings-field">
          <span>Starts</span>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={toLocalInputValue(row?.startsAt)}
            disabled={pending}
          />
        </label>
        <label className="settings-field">
          <span>Ends</span>
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={toLocalInputValue(row?.endsAt)}
            disabled={pending}
          />
        </label>
        <label className="settings-field">
          <span>Status</span>
          <select name="status" defaultValue={row?.status ?? 'draft'} disabled={pending}>
            {statusChoices.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {row?.status === 'live' ? <option value="live">live</option> : null}
          </select>
          <span className="settings-hint">
            Go-live / Social publish is not available in this slice.
          </span>
        </label>
        <div className="settings-field">
          {mediaEnabled ? (
            <>
              <MediaPicker
                label="Creative"
                value={{ mediaId: creativeMediaId, url: '', alt: '' }}
                defaultFolder="general"
                defaultPurpose="photo"
                disabled={pending}
                includeHiddenInputs={false}
                allowUrlFallback={false}
                hint="Media library creative. Media owns the file."
                onChange={(next) => setCreativeMediaId(next.mediaId)}
              />
              <input type="hidden" name="creativeMediaId" value={creativeMediaId} />
            </>
          ) : (
            <>
              <span>Creative media id</span>
              <input
                type="text"
                name="creativeMediaId"
                defaultValue={row?.creativeMediaId ?? ''}
                disabled={pending}
                autoComplete="off"
              />
              <span className="settings-hint">
                Enable Media under Settings → Modules to use the MediaPicker. Otherwise paste a
                mediaId.
              </span>
            </>
          )}
        </div>
        <label className="settings-field">
          <span>Copy title</span>
          <input
            type="text"
            name="copyTitle"
            defaultValue={row?.copyTitle ?? ''}
            disabled={pending}
            autoComplete="off"
          />
        </label>
        <label className="settings-field">
          <span>Copy body</span>
          <textarea
            name="copyBody"
            rows={3}
            defaultValue={row?.copyBody ?? ''}
            disabled={pending}
          />
        </label>
      </div>
    </fieldset>
  )
}

function AddCampaignPanel({
  packages,
  placements,
  mediaEnabled,
}: {
  packages: AdsPackageRecord[]
  placements: AdsPlacementRecord[]
  mediaEnabled: boolean
}) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [state, action, pending] = useActionState(createCampaignAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setCreateOpen(false)
    setFormKey((k) => k + 1)
    router.refresh()
  }, [state.ok, router])

  const canCreate = packages.length > 0

  return (
    <div className={`sf-ads-add-panel${createOpen ? ' is-open' : ''}`} aria-label="Add campaign">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={createOpen}
            aria-controls="sf-ads-add-campaign-form"
            disabled={!canCreate}
            onClick={() => setCreateOpen((open) => !open)}
          >
            {createOpen ? 'Close' : 'Add +'}
          </button>
          {!createOpen ? (
            <p className="settings-hint sf-events-add-hint">
              {canCreate
                ? 'Click Add + for a draft campaign. Social publish comes later.'
                : 'Create a package before adding a campaign.'}
            </p>
          ) : null}
        </div>
      </section>
      {createOpen && canCreate ? (
        <div className="sf-ads-campaign-edit sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-ads-add-campaign-form"
            action={action}
            aria-label="Create campaign"
            className="sf-events-form-mosaic-form"
          >
            <CampaignFields
              packages={packages}
              placements={placements}
              pending={pending}
              mediaEnabled={mediaEnabled}
            />
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sf-ads-add-campaign-form"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Create'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EditCampaignForm({
  row,
  packages,
  placements,
  mediaEnabled,
  onClose,
  onDeleted,
}: {
  row: AdsCampaignRecord
  packages: AdsPackageRecord[]
  placements: AdsPlacementRecord[]
  mediaEnabled: boolean
  onClose: () => void
  onDeleted: () => void
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(updateCampaignAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCampaignAction, initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(deleteState)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])
  useEffect(() => {
    if (!deleteState.ok) return
    onDeleted()
    router.refresh()
  }, [deleteState.ok, onDeleted, router])

  const busy = pending || deletePending
  const formId = `sf-ads-edit-campaign-${row.id}`
  const feedback = state.error ? state : deleteState.error ? deleteState : state
  const packageTitle = packages.find((p) => p.id === row.packageId)?.title || row.packageId

  return (
    <div
      className="sf-ads-campaign-edit sf-events-form-mosaic"
      aria-label={`Edit campaign ${row.copyTitle || row.id}`}
    >
      <form id={formId} action={action} className="sf-events-form-mosaic-form">
        <input type="hidden" name="id" value={row.id} />
        <CampaignFields
          row={row}
          packages={packages}
          placements={placements}
          pending={busy}
          mediaEnabled={mediaEnabled}
        />
      </form>
      <Feedback state={feedback} />
      <div className="sf-events-form-actions admin-action-row page-settings-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="submit"
          form={formId}
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <AdminConfirmDialog
        open={confirmDelete}
        title="Delete campaign"
        message={`Delete campaign for package “${packageTitle}”?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false)
          const fd = new FormData()
          fd.set('id', row.id)
          startTransition(() => {
            void deleteAction(fd)
          })
        }}
      />
    </div>
  )
}

export function CampaignsManager({ campaigns, packages, placements, mediaEnabled }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = campaigns.find((c) => c.id === openId) ?? null
  const packageTitle = (id: string) => packages.find((p) => p.id === id)?.title || id

  return (
    <div className="sf-ads-campaigns-manager">
      <AddCampaignPanel
        packages={packages}
        placements={placements}
        mediaEnabled={mediaEnabled}
      />

      <section className="outlines-create sf-ads-campaigns-list" aria-label="Campaigns">
        {campaigns.length === 0 ? (
          <p className="settings-hint">No campaigns yet.</p>
        ) : (
          <ul className="sf-ads-entity-list">
            {campaigns.map((row) => {
              const isOpen = openId === row.id
              return (
                <li key={row.id} className="page-settings-panel">
                  <div className="page-settings-panel-head">
                    <div>
                      <strong>{row.copyTitle || packageTitle(row.packageId)}</strong>
                      <p className="settings-hint">
                        {row.status}
                        {row.buyerUserId ? ` · buyer ${row.buyerUserId}` : ''}
                        {row.socialPostId ? ` · social ${row.socialPostId}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      aria-expanded={isOpen}
                      onClick={() => setOpenId(isOpen ? null : row.id)}
                    >
                      {isOpen ? 'Close' : 'Edit'}
                    </button>
                  </div>
                  {isOpen && open ? (
                    <div className="page-settings-panel-body">
                      <EditCampaignForm
                        row={open}
                        packages={packages}
                        placements={placements}
                        mediaEnabled={mediaEnabled}
                        onClose={() => setOpenId(null)}
                        onDeleted={() => setOpenId(null)}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
