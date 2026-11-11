'use client'

import React, { useActionState, useEffect, useId, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { cssColorToColorInputValue } from '@/core/modules/styles'

import {
  createTicketTierAction,
  deleteTicketTierAction,
  reorderTicketTiersAction,
  updateTicketTierAction,
  type EventsAdminActionState,
} from '../actions'
import { formatPriceModifierInput, type PriceAdjustMode } from '../price-rules'
import { TICKET_TIER_KINDS } from '../types'

type EventOpt = { id: string; title: string }

type TierRow = {
  id: string
  eventId: string
  title: string
  shortDescription: string
  description: string
  kind: string
  capacity: number | null
  maxPerBooking: number | null
  price: number | null
  priceModifier: number
  priceModifierMode: PriceAdjustMode
  priceLabel: string
  titleColor: string
  borderColor: string
  backgroundColor: string
  sortOrder: number
  occupied: number
  updatedAt: string
}

type Props = {
  events: EventOpt[]
  eventId: string
  tiers: TierRow[]
  /** Hide event picker when embedded on the event editor. */
  embedded?: boolean
}

const initial: EventsAdminActionState = {}

/** Empty or pure white → keep the default blue drag rail. */
function isUnsetOrWhiteTierColor(raw: string | undefined | null): boolean {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return true
  return cssColorToColorInputValue(trimmed).toLowerCase() === '#ffffff'
}

function Feedback({ state }: { state: EventsAdminActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function TierColorField({
  name,
  label,
  defaultValue = '',
  disabled,
  onValueChange,
}: {
  name: string
  label: string
  defaultValue?: string
  disabled?: boolean
  onValueChange?: (value: string) => void
}) {
  const [text, setText] = useState(defaultValue.trim())

  function setColor(next: string) {
    setText(next)
    onValueChange?.(next)
  }

  return (
    <label className="settings-field sf-events-tiers-color-field">
      <span className="sf-events-tiers-color-row">
        <span className="sf-events-tiers-color-label">{label}</span>
        <input
          type="color"
          className="gantry-color-swatch sf-events-tiers-color-swatch"
          value={cssColorToColorInputValue(text)}
          disabled={disabled}
          title={label}
          aria-label={`${label} picker`}
          onChange={(event) => setColor(event.target.value)}
        />
        <input
          type="text"
          name={name}
          className="sf-events-tiers-color-hex"
          value={text}
          disabled={disabled}
          onChange={(event) => setColor(event.target.value)}
          placeholder="#ffffff"
          spellCheck={false}
          autoComplete="off"
        />
      </span>
    </label>
  )
}

function TierFields({
  row,
  busy,
  registeredLabel,
  sortOrder,
  onBorderColorChange,
}: {
  row?: TierRow
  busy: boolean
  registeredLabel?: string
  sortOrder?: number
  onBorderColorChange?: (value: string) => void
}) {
  return (
    <div className="sf-events-tiers-fields">
      <div className="sf-events-tiers-row-main">
        <label className="settings-field sf-events-tiers-title-field">
          <span>Title</span>
          <input
            type="text"
            name="title"
            required
            maxLength={200}
            defaultValue={row?.title ?? ''}
            disabled={busy}
            autoComplete="off"
            placeholder="General / Blue team"
          />
        </label>
        <label className="settings-field sf-events-tiers-kind-field">
          <span>Kind</span>
          <select name="kind" defaultValue={row?.kind ?? 'general'} disabled={busy}>
            {TICKET_TIER_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="settings-field sf-events-tiers-num-field">
          <span>Price</span>
          <input
            type="number"
            name="price"
            step={1}
            defaultValue={row?.price ?? ''}
            disabled={busy}
            placeholder="Event base"
            title="This ticket type's price. Empty uses the event base price."
          />
        </label>
        <label className="settings-field sf-events-tiers-num-field">
          <span>Modifier</span>
          <input
            type="text"
            name="priceModifier"
            inputMode="decimal"
            defaultValue={
              row
                ? formatPriceModifierInput({
                    mode: row.priceModifierMode,
                    value: row.priceModifier,
                  })
                : ''
            }
            disabled={busy}
            placeholder="0 or 10%"
            autoComplete="off"
            title="Number = amount; add % for percent of the price in effect (e.g. 500 or -10%)"
          />
        </label>
        <label className="settings-field sf-events-tiers-price-field">
          <span>Price text</span>
          <input
            type="text"
            name="priceLabel"
            maxLength={80}
            defaultValue={row?.priceLabel ?? ''}
            disabled={busy}
            autoComplete="off"
            placeholder="Optional override"
            title="When set, overwrites the numeric price on public cards. Checkout still uses the calculated amount."
          />
        </label>
        <label className="settings-field sf-events-tiers-num-field">
          <span>Capacity</span>
          <input
            type="number"
            name="capacity"
            min={0}
            step={1}
            defaultValue={row?.capacity ?? ''}
            disabled={busy}
            placeholder="∞"
          />
        </label>
        <label className="settings-field sf-events-tiers-num-field">
          <span>Max/book</span>
          <input
            type="number"
            name="maxPerBooking"
            min={1}
            max={100}
            step={1}
            defaultValue={row?.maxPerBooking ?? ''}
            disabled={busy}
            placeholder="20"
            title="Maximum tickets (guests) allowed on one registration"
          />
        </label>
        {registeredLabel != null ? (
          <div className="settings-field sf-events-tiers-registered-field">
            <span>Reg</span>
            <p className="sf-events-tiers-registered" title="Registered guests on this tier">
              {registeredLabel}
            </p>
          </div>
        ) : null}
        {sortOrder != null ? (
          <input type="hidden" name="sortOrder" value={sortOrder} />
        ) : null}
      </div>

      <div className="sf-events-tiers-row-meta">
        <label className="settings-field sf-events-tiers-desc sf-events-tiers-desc-short">
          <span>Short description</span>
          <input
            type="text"
            name="shortDescription"
            maxLength={280}
            defaultValue={row?.shortDescription ?? ''}
            disabled={busy}
            placeholder="Card blurb on the public event page"
          />
        </label>
        <label className="settings-field sf-events-tiers-desc sf-events-tiers-desc-long">
          <span>Description</span>
          <input
            type="text"
            name="description"
            maxLength={2000}
            defaultValue={row?.description ?? ''}
            disabled={busy}
            placeholder="Fallback if short blurb is empty"
          />
        </label>
        <TierColorField
          name="titleColor"
          label="Title"
          defaultValue={row?.titleColor}
          disabled={busy}
        />
        <TierColorField
          name="borderColor"
          label="Border"
          defaultValue={row?.borderColor}
          disabled={busy}
          onValueChange={onBorderColorChange}
        />
        <TierColorField
          name="backgroundColor"
          label="Background"
          defaultValue={row?.backgroundColor}
          disabled={busy}
        />
      </div>
    </div>
  )
}

function SortableTierRow({
  row,
  index,
  busy,
  updatePending,
  updateAction,
  deleteAction,
}: {
  row: TierRow
  index: number
  busy: boolean
  updatePending: boolean
  updateAction: (payload: FormData) => void
  deleteAction: (payload: FormData) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })
  const [borderColor, setBorderColor] = useState(row.borderColor)
  useEffect(() => {
    setBorderColor(row.borderColor)
  }, [row.borderColor])
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const dragRailStyle: React.CSSProperties | undefined = isUnsetOrWhiteTierColor(borderColor)
    ? undefined
    : ({
        '--sf-events-tiers-drag': cssColorToColorInputValue(borderColor),
        '--sf-events-tiers-drag-mix': '#ffffff',
      } as React.CSSProperties)
  const registeredLabel =
    typeof row.capacity === 'number'
      ? `${row.occupied}/${row.capacity}`
      : String(row.occupied)

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`sf-events-tiers-row${isDragging ? ' is-dragging' : ''}`}
    >
      <form action={updateAction} className="sf-events-tiers-edit-form">
        <input type="hidden" name="id" value={row.id} />
        <input type="hidden" name="eventId" value={row.eventId} />
        <div className="sf-events-tiers-row-shell">
          <button
            type="button"
            className="sf-events-tiers-drag-rail"
            style={dragRailStyle}
            aria-label={`Drag to reorder ${row.title || 'ticket type'}`}
            title="Drag to reorder"
            disabled={busy}
            {...attributes}
            {...listeners}
          />
          <div className="sf-events-tiers-row-body">
            <TierFields
              row={row}
              busy={busy}
              registeredLabel={registeredLabel}
              sortOrder={index}
              onBorderColorChange={setBorderColor}
            />
            <div className="sf-events-tiers-row-actions">
              <button
                type="submit"
                className="sf-events-tiers-icon-btn sf-events-tiers-save-btn"
                disabled={busy}
                aria-label={updatePending ? 'Saving' : `Save ${row.title || 'ticket type'}`}
                title="Save"
              >
                <svg
                  className="sf-events-tiers-icon"
                  viewBox="0 0 16 16"
                  width="1em"
                  height="1em"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M3 1.75h7.25L13.5 4.9V14.25H3z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M5 1.75v3.6h5.25V1.75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M5 9.1h6V14.1H5z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </button>
              <button
                type="submit"
                formAction={deleteAction}
                className="sf-events-tiers-icon-btn sf-events-tiers-delete-btn"
                disabled={busy}
                aria-label={`Delete ${row.title || 'ticket type'}`}
                title="Delete"
                onClick={(e) => {
                  if (!window.confirm(`Delete tier “${row.title}”?`)) {
                    e.preventDefault()
                  }
                }}
              >
                <svg
                  className="sf-events-tiers-delete-icon"
                  viewBox="0 0 16 16"
                  width="1em"
                  height="1em"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M3.25 3.25 L12.75 12.75 M12.75 3.25 L3.25 12.75"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="square"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </form>
    </li>
  )
}

/**
 * Per-event ticket types — compact full-width faction list with DnD reorder.
 * Global `/admin/events/tiers` is only a cross-event shortcut (pick event → same UI).
 */
export function TiersManager({ events, eventId, tiers, embedded = false }: Props) {
  const router = useRouter()
  const dndId = useId()
  const [createOpen, setCreateOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [orderedTiers, setOrderedTiers] = useState(tiers)
  const [reorderPending, startReorder] = useTransition()
  const [createState, createAction, createPending] = useActionState(
    createTicketTierAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateTicketTierAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTicketTierAction,
    initial,
  )
  const [reorderState, setReorderState] = useState<EventsAdminActionState>({})

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(reorderState)

  useEffect(() => {
    setOrderedTiers(tiers)
  }, [tiers])

  useEffect(() => {
    if (createState.ok) {
      setCreateOpen(false)
      setFormKey((k) => k + 1)
      router.refresh()
      return
    }
    if (updateState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  useEffect(() => {
    if (createState.error) setCreateOpen(true)
  }, [createState.error])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sortableIds = useMemo(() => orderedTiers.map((t) => t.id), [orderedTiers])
  const busy = createPending || updatePending || deletePending || reorderPending
  const eventTitle = events.find((e) => e.id === eventId)?.title

  function resetCreate() {
    setCreateOpen(false)
    setFormKey((k) => k + 1)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedTiers.findIndex((t) => t.id === active.id)
    const newIndex = orderedTiers.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const next = arrayMove(orderedTiers, oldIndex, newIndex)
    setOrderedTiers(next)

    const fd = new FormData()
    fd.set('eventId', eventId)
    fd.set('orderedIds', next.map((t) => t.id).join(','))
    startReorder(async () => {
      const result = await reorderTicketTiersAction({}, fd)
      setReorderState(result)
      if (result.ok) router.refresh()
      if (result.error) setOrderedTiers(tiers)
    })
  }

  const addBar = !eventId || events.length === 0 ? null : (
    <div className="sf-events-add-bar">
      <button
        type="button"
        className={`gantry-toolbar-btn${
          createOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'
        }`}
        aria-expanded={createOpen}
        aria-controls="sf-tiers-add-form"
        onClick={() => {
          if (createOpen) resetCreate()
          else setCreateOpen(true)
        }}
      >
        {createOpen ? 'Close' : 'Add +'}
      </button>
      {!createOpen ? (
        <p className="settings-hint sf-events-add-hint">
          New ticket / faction — drag the left rail to reorder.
        </p>
      ) : null}
    </div>
  )

  const addForm =
    !eventId || events.length === 0 || !createOpen ? null : (
      <form
        key={formKey}
        id="sf-tiers-add-form"
        action={createAction}
        className="sf-events-add-inline-form sf-events-tiers-edit-form sf-events-tiers-add-form"
        aria-label="Add ticket type"
      >
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="sortOrder" value={orderedTiers.length} />
        <TierFields busy={busy} />
        <div className="sf-events-form-actions page-settings-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={createPending}
            onClick={resetCreate}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={createPending}
          >
            {createPending ? 'Adding…' : 'Add'}
          </button>
        </div>
        <Feedback state={createState} />
      </form>
    )

  const tiersList =
    !eventId || events.length === 0 ? null : orderedTiers.length === 0 ? (
      <p className="admin-empty">
        No ticket types yet — use <strong>Add +</strong>. Without tiers, public signup skips the
        ticket select.
      </p>
    ) : (
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ul className="sf-events-tiers-list" aria-label="Ticket types">
            {orderedTiers.map((row, index) => (
              <SortableTierRow
                key={row.id}
                row={row}
                index={index}
                busy={busy}
                updatePending={updatePending}
                updateAction={updateAction}
                deleteAction={deleteAction}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    )

  return (
    <div className="sf-events-tiers-manager admin-settings-mosaic">
      {embedded ? null : (
        <section className="outlines-create sf-events-tiers-wide" aria-label="Select event">
          <h3>Choose event</h3>
          <p className="settings-hint">
            Ticket types belong to one event (EB approach). Prefer managing them on the event
            editor; this page is a shortcut across events.
          </p>
          <div className="sf-events-filters">
            <div className="sf-events-filter-group" role="group" aria-label="Events">
              {events.length === 0 ? (
                <p className="admin-empty">
                  Create an <Link href="/admin/events">event</Link> first.
                </p>
              ) : (
                events.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/admin/events/tiers?eventId=${encodeURIComponent(ev.id)}`}
                    className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                      eventId === ev.id ? ' is-active' : ''
                    }`}
                    aria-current={eventId === ev.id ? 'true' : undefined}
                  >
                    {ev.title}
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {!eventId || events.length === 0 ? null : embedded ? (
        <div className="sf-events-tiers-embedded" aria-label="Ticket types for event">
          {addBar}
          {addForm}
          <Feedback state={updateState} />
          <Feedback state={deleteState} />
          <Feedback state={reorderState} />
          {tiersList}
        </div>
      ) : (
        <>
          <section
            className="outlines-create sf-events-add-panel sf-events-tiers-wide"
            aria-label="Add ticket type"
          >
            {addBar}
            {addForm}
          </section>

          <section
            className="outlines-create sf-events-tiers-wide"
            aria-label="Ticket types for event"
          >
            <h3>
              Ticket types
              {eventTitle ? (
                <>
                  {' '}
                  —{' '}
                  <Link href={`/admin/events/${encodeURIComponent(eventId)}`}>{eventTitle}</Link>
                </>
              ) : null}
            </h3>
            <p className="settings-hint">
              Compact faction / ticket list — primary fields on one line, descriptions and colors
              below. Drag the left rail to reorder. Signup skips sold-out options; payments stay
              deferred.
            </p>

            <Feedback state={updateState} />
            <Feedback state={deleteState} />
            <Feedback state={reorderState} />
            {tiersList}
          </section>
        </>
      )}
    </div>
  )
}
