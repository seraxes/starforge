'use client'

import React, { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { MediaPicker, type MediaPickerValue } from '@/modules/media/api'

import {
  createKmlOverlayAction,
  createPointOverlayAction,
  createTeamAction,
  deleteOverlayAction,
  deleteTeamAction,
  seedRoomFromFactionsAction,
  setRoomAdminsAction,
  setTeamMembersAction,
  updateMapRoomAction,
  updateTeamAction,
} from '../actions'

type UserOpt = { id: string; label: string }

type TeamRow = {
  id: string
  name: string
  color: string
  memberIds: string[]
  ticketTierId: string
}

type OverlayRow = {
  id: string
  kind: string
  pointKind: string
  label: string
  latitude: number | null
  longitude: number | null
  mediaId: string
}

export function MapsRoomEditor({
  room,
  adminIds,
  teams,
  overlays,
  users,
}: {
  room: {
    id: string
    title: string
    active: boolean
    ownerUserId: string
    eventId: string
  }
  adminIds: string[]
  teams: TeamRow[]
  overlays: OverlayRow[]
  users: UserOpt[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState(room.title)
  const [active, setActive] = useState(room.active)
  const [admins, setAdmins] = useState<string[]>(adminIds)
  const [teamName, setTeamName] = useState('')
  const [teamColor, setTeamColor] = useState('#3b82f6')
  const [addTeamOpen, setAddTeamOpen] = useState(false)
  const [pointLabel, setPointLabel] = useState('Base')
  const [pointLat, setPointLat] = useState('')
  const [pointLng, setPointLng] = useState('')
  const [pointKind, setPointKind] = useState<'base' | 'poi'>('base')
  const [kmlLabel, setKmlLabel] = useState('KML layer')
  const [kmlMedia, setKmlMedia] = useState<MediaPickerValue>({
    mediaId: '',
    url: '',
    alt: '',
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const userLabel = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, u.label]))
    return (id: string) => map.get(id) || id
  }, [users])

  function refresh() {
    router.refresh()
  }

  function flashOk(text: string) {
    setError('')
    setMessage(text)
  }

  return (
    <div className="sf-maps-room-editor admin-settings-mosaic">
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="admin-inline-ok" role="status">
          {message}
        </p>
      ) : null}

      <fieldset className="settings-fieldset">
        <legend>Room</legend>
        <label className="settings-field">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="settings-field">
          <span>Active</span>
          <span className="settings-hint">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={pending}
            />{' '}
            Join / ingest allowed when active
          </span>
        </label>
        <p className="settings-hint">Owner: {userLabel(room.ownerUserId)}</p>
        <div className="admin-action-row page-settings-actions">
          <button
            type="button"
            className="gantry-toolbar-btn"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await seedRoomFromFactionsAction(room.id)
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                flashOk(
                  `Seeded ${result.teamsCreated} teams, ${result.membersAdded} members.`,
                )
                refresh()
              })
            }}
          >
            Re-seed factions
          </button>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await updateMapRoomAction({
                  roomId: room.id,
                  title,
                  active,
                })
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                flashOk('Room saved.')
                refresh()
              })
            }}
          >
            Save
          </button>
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Admins</legend>
        <p className="settings-hint">
          Admins can edit teams, roster, and overlays (same level as owner in v1).
        </p>
        <div className="settings-field">
          <span>Admin users</span>
          <select
            multiple
            size={8}
            value={admins}
            disabled={pending}
            onChange={(e) => {
              setAdmins(Array.from(e.target.selectedOptions).map((o) => o.value))
            }}
          >
            {users
              .filter((u) => u.id !== room.ownerUserId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
          </select>
        </div>
        <div className="admin-action-row page-settings-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await setRoomAdminsAction({
                  roomId: room.id,
                  userIds: admins,
                })
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                flashOk('Admins saved.')
                refresh()
              })
            }}
          >
            Save
          </button>
        </div>
      </fieldset>

      <section className="outlines-create settings-fieldset-wide" aria-label="Teams">
        {/* h3 must be a direct child for Page Settings panel-head chrome */}
        <h3>Teams</h3>
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${addTeamOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={addTeamOpen}
            aria-controls="sf-maps-add-team-form"
            disabled={pending}
            onClick={() => setAddTeamOpen((v) => !v)}
          >
            {addTeamOpen ? 'Close' : 'Add +'}
          </button>
          {!addTeamOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Same-team roster only on the live map — Add + or Re-seed factions.
            </p>
          ) : null}
        </div>

        {addTeamOpen ? (
          <div id="sf-maps-add-team-form" className="sf-events-add-inline-form">
            <label className="settings-field">
              <span>Name</span>
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Color</span>
              <input
                type="color"
                value={teamColor}
                onChange={(e) => setTeamColor(e.target.value)}
                disabled={pending}
              />
            </label>
            <div className="sf-events-form-actions page-settings-actions">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={pending}
                onClick={() => {
                  setAddTeamOpen(false)
                  setTeamName('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={pending || !teamName.trim()}
                onClick={() => {
                  startTransition(async () => {
                    const result = await createTeamAction({
                      roomId: room.id,
                      name: teamName,
                      color: teamColor,
                    })
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setTeamName('')
                    setAddTeamOpen(false)
                    flashOk('Team added.')
                    refresh()
                  })
                }}
              >
                Save
              </button>
            </div>
          </div>
        ) : null}

        {teams.length === 0 ? (
          <p className="admin-empty">No teams yet — Add + or Re-seed factions.</p>
        ) : (
          teams.map((team) => (
            <TeamEditor
              key={team.id}
              team={team}
              users={users}
              pending={pending}
              onSaveMeta={(name, color) => {
                startTransition(async () => {
                  const result = await updateTeamAction({
                    teamId: team.id,
                    name,
                    color,
                  })
                  if (!result.ok) {
                    setError(result.error)
                    return
                  }
                  flashOk(`Saved ${name}.`)
                  refresh()
                })
              }}
              onSaveMembers={(memberIds) => {
                startTransition(async () => {
                  const result = await setTeamMembersAction({
                    teamId: team.id,
                    userIds: memberIds,
                  })
                  if (!result.ok) {
                    setError(result.error)
                    return
                  }
                  flashOk(`Roster saved for ${team.name}.`)
                  refresh()
                })
              }}
              onDelete={() => {
                if (!confirm(`Delete team ${team.name}?`)) return
                startTransition(async () => {
                  const result = await deleteTeamAction(team.id)
                  if (!result.ok) {
                    setError(result.error)
                    return
                  }
                  flashOk('Team deleted.')
                  refresh()
                })
              }}
            />
          ))
        )}
      </section>

      <fieldset className="settings-fieldset">
        <legend>Point overlay</legend>
        <label className="settings-field">
          <span>Label</span>
          <input
            value={pointLabel}
            onChange={(e) => setPointLabel(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="settings-field">
          <span>Kind</span>
          <select
            value={pointKind}
            onChange={(e) =>
              setPointKind(e.target.value === 'base' ? 'base' : 'poi')
            }
            disabled={pending}
          >
            <option value="base">Base</option>
            <option value="poi">POI</option>
          </select>
        </label>
        <label className="settings-field">
          <span>Latitude</span>
          <input
            value={pointLat}
            onChange={(e) => setPointLat(e.target.value)}
            disabled={pending}
            inputMode="decimal"
          />
        </label>
        <label className="settings-field">
          <span>Longitude</span>
          <input
            value={pointLng}
            onChange={(e) => setPointLng(e.target.value)}
            disabled={pending}
            inputMode="decimal"
          />
        </label>
        <div className="admin-action-row page-settings-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await createPointOverlayAction({
                  roomId: room.id,
                  label: pointLabel,
                  latitude: Number(pointLat),
                  longitude: Number(pointLng),
                  pointKind,
                })
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                flashOk('Point added.')
                refresh()
              })
            }}
          >
            Save
          </button>
        </div>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>KML / KMZ overlay</legend>
        <label className="settings-field">
          <span>Label</span>
          <input
            value={kmlLabel}
            onChange={(e) => setKmlLabel(e.target.value)}
            disabled={pending}
          />
        </label>
        <div className="settings-field">
          <MediaPicker
            label="File"
            value={kmlMedia}
            onChange={setKmlMedia}
            defaultPurpose="document"
            allowUrlFallback={false}
            hint="Shared Media Manager — upload .kml / .kmz as document."
          />
        </div>
        <div className="admin-action-row page-settings-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending || !kmlMedia.mediaId}
            onClick={() => {
              startTransition(async () => {
                const result = await createKmlOverlayAction({
                  roomId: room.id,
                  label: kmlLabel,
                  mediaId: kmlMedia.mediaId,
                })
                if (!result.ok) {
                  setError(result.error)
                  return
                }
                setKmlMedia({ mediaId: '', url: '', alt: '' })
                flashOk('KML overlay added.')
                refresh()
              })
            }}
          >
            Save
          </button>
        </div>
      </fieldset>

      <section className="outlines-create settings-fieldset-wide" aria-label="Overlays list">
        <h3>Overlays</h3>
        {overlays.length === 0 ? (
          <p className="admin-empty">No overlays yet.</p>
        ) : (
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {overlays.map((o) => (
                  <tr key={o.id}>
                    <td>{o.label || '—'}</td>
                    <td>
                      {o.kind}
                      {o.kind === 'point' ? ` / ${o.pointKind}` : ''}
                    </td>
                    <td className="sf-events-list-wrap">
                      {o.kind === 'point'
                        ? `${o.latitude ?? '—'}, ${o.longitude ?? '—'}`
                        : o.mediaId || '—'}
                    </td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              await deleteOverlayAction({
                                overlayId: o.id,
                                roomId: room.id,
                              })
                              flashOk('Overlay removed.')
                              refresh()
                            })
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function TeamEditor({
  team,
  users,
  pending,
  onSaveMeta,
  onSaveMembers,
  onDelete,
}: {
  team: TeamRow
  users: UserOpt[]
  pending: boolean
  onSaveMeta: (name: string, color: string) => void
  onSaveMembers: (ids: string[]) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(team.name)
  const [color, setColor] = useState(team.color)
  const [memberIds, setMemberIds] = useState(team.memberIds)

  return (
    <fieldset className="settings-fieldset sf-maps-team-card">
      <legend>{team.name}</legend>
      <label className="settings-field">
        <span>Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
        />
      </label>
      <label className="settings-field">
        <span>Color</span>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={pending}
        />
      </label>
      {team.ticketTierId ? (
        <p className="settings-hint">Seeded from ticket tier</p>
      ) : null}
      <div className="settings-field">
        <span>Roster</span>
        <select
          multiple
          size={6}
          value={memberIds}
          disabled={pending}
          onChange={(e) => {
            setMemberIds(Array.from(e.target.selectedOptions).map((o) => o.value))
          }}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="admin-action-row page-settings-actions">
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={pending}
          onClick={onDelete}
        >
          Delete
        </button>
        <button
          type="button"
          className="gantry-toolbar-btn"
          disabled={pending}
          onClick={() => onSaveMembers(memberIds)}
        >
          Save roster
        </button>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={pending}
          onClick={() => onSaveMeta(name, color)}
        >
          Save
        </button>
      </div>
    </fieldset>
  )
}
