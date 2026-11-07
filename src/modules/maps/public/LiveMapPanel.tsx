'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { MapClientConfig } from '@/core/maps/types'
import { useRealtimeChannel } from '@/core/realtime/use-realtime'

import { mapTeamChannel } from '../channels'
import { LiveMapLeaflet } from './LiveMapLeaflet'

export type LiveOverlayDto = {
  id: string
  kind: string
  pointKind: string
  label: string
  latitude: number | null
  longitude: number | null
  mediaId: string
}

export type LiveTeammateDto = {
  userId: string
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  updatedAt: string
  stale: boolean
}

type SessionState = {
  sessionId: string
  roomId: string
  teamId: string
  teamName: string
  teamColor: string
  channel: string
}

type Props = {
  roomId: string
  roomTitle: string
  clientConfig: MapClientConfig
  overlays: LiveOverlayDto[]
  height?: string
  /** When set, skip discovery and use this room context from SSR. */
  canJoin: boolean
  membershipTeamId?: string
  membershipTeamName?: string
  membershipTeamColor?: string
  initialPositions?: LiveTeammateDto[]
  center?: { lat: number; lng: number }
}

/**
 * Live tactical map client — Join/Leave, geolocation ingest, RealtimePort markers.
 */
export function LiveMapPanel({
  roomId,
  roomTitle,
  clientConfig,
  overlays,
  height = '24rem',
  canJoin,
  membershipTeamId,
  membershipTeamName,
  membershipTeamColor,
  initialPositions = [],
  center,
}: Props) {
  const [session, setSession] = useState<SessionState | null>(null)
  const [positions, setPositions] = useState<LiveTeammateDto[]>(initialPositions)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const watchRef = useRef<number | null>(null)
  const sessionRef = useRef<SessionState | null>(null)
  sessionRef.current = session

  const channel = session?.channel || ''

  const onRealtime = useCallback(
    (event: { type: string; payload: Record<string, unknown> }) => {
      if (event.type === 'map.position' || event.type === 'map.position.clear') {
        void refreshSnapshot(sessionRef.current)
      }
    },
    [],
  )

  useRealtimeChannel({
    enabled: Boolean(session?.channel),
    channels: channel ? [channel] : [],
    onEvent: onRealtime,
  })

  async function refreshSnapshot(active: SessionState | null) {
    if (!active) return
    try {
      const res = await fetch(
        `/api/maps/live/${encodeURIComponent(active.roomId)}/positions`,
        { credentials: 'include' },
      )
      if (!res.ok) return
      const data = (await res.json()) as { positions?: LiveTeammateDto[] }
      if (Array.isArray(data.positions)) setPositions(data.positions)
    } catch {
      // ignore transient errors
    }
  }

  async function join() {
    setError('')
    setStatus('Joining…')
    try {
      const res = await fetch(`/api/maps/live/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Join failed')
        setStatus('')
        return
      }
      const next: SessionState = {
        sessionId: data.sessionId,
        roomId: data.roomId,
        teamId: data.teamId,
        teamName: data.teamName || membershipTeamName || 'Team',
        teamColor: data.teamColor || membershipTeamColor || '#3b82f6',
        channel: data.channel || mapTeamChannel(data.roomId, data.teamId),
      }
      setSession(next)
      setStatus('Sharing location — Leave to stop.')
      startWatch(next)
      await refreshSnapshot(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Join failed')
      setStatus('')
    }
  }

  async function leave() {
    const active = sessionRef.current
    stopWatch()
    setSession(null)
    setStatus('')
    if (!active) return
    try {
      await fetch(`/api/maps/live/${encodeURIComponent(active.roomId)}/leave`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // ignore
    }
    setPositions((prev) => prev.filter((p) => p.userId !== active.sessionId))
    await refreshSnapshot(null)
  }

  function stopWatch() {
    if (watchRef.current != null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
  }

  function startWatch(active: SessionState) {
    stopWatch()
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not available in this browser.')
      return
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        void postPosition(active, pos)
      },
      (err) => {
        setError(err.message || 'Geolocation error')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      },
    )
  }

  async function postPosition(
    active: SessionState,
    pos: GeolocationPosition,
  ) {
    try {
      await fetch(`/api/maps/live/${encodeURIComponent(active.roomId)}/ingest`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
        }),
        keepalive: true,
      })
    } catch {
      // ignore; next tick retries
    }
  }

  useEffect(() => {
    return () => {
      stopWatch()
    }
  }, [])

  // Capacitor / ASN bridge: keep watching while session active (background plugin later).
  useEffect(() => {
    const bridge = (
      globalThis as typeof globalThis & {
        StarforgeLiveMap?: {
          onSession?: (payload: { roomId: string; active: boolean }) => void
        }
      }
    ).StarforgeLiveMap
    bridge?.onSession?.({ roomId, active: Boolean(session) })
  }, [roomId, session])

  const markers = useMemo(() => {
    const list = positions
      .filter((p) => !p.stale)
      .map((p) => ({
        id: p.userId,
        lat: p.latitude,
        lng: p.longitude,
        label: p.userId.slice(0, 8),
        color: session?.teamColor || membershipTeamColor || '#3b82f6',
      }))
    for (const o of overlays) {
      if (
        o.kind === 'point' &&
        o.latitude != null &&
        o.longitude != null
      ) {
        list.push({
          id: `overlay-${o.id}`,
          lat: o.latitude,
          lng: o.longitude,
          label: o.label || o.pointKind,
          /* Match --sf-primary / muted tokens (Leaflet needs concrete colors). */
          color: o.pointKind === 'base' ? '#e87722' : '#64748b',
        })
      }
    }
    return list
  }, [positions, overlays, session, membershipTeamColor])

  return (
    <div className="sf-live-map">
      <div className="sf-live-map-bar">
        <div className="sf-live-map-bar-meta">
          <p className="sf-live-map-room-title">{roomTitle}</p>
          {session ? (
            <p className="sf-live-map-status">
              {session.teamName}
              <span className="sf-live-map-status-dot" aria-hidden="true" />
              Sharing location
            </p>
          ) : membershipTeamId ? (
            <p className="sf-live-map-status">
              Roster: {membershipTeamName || 'team'}
            </p>
          ) : (
            <p className="sf-live-map-status">Not on this map&apos;s roster</p>
          )}
        </div>
        <div className="sf-live-map-bar-actions">
          {canJoin && !session ? (
            <button type="button" className="sf-live-map-btn sf-live-map-btn-primary" onClick={join}>
              Join map
            </button>
          ) : null}
          {session ? (
            <button type="button" className="sf-live-map-btn" onClick={leave}>
              Leave map
            </button>
          ) : null}
        </div>
      </div>
      {status ? <p className="sf-live-map-hint">{status}</p> : null}
      {error ? (
        <p className="sf-live-map-error" role="alert">
          {error}
        </p>
      ) : null}
      <LiveMapLeaflet
        clientConfig={clientConfig}
        markers={markers}
        center={center}
        height={height}
      />
      {overlays.some((o) => o.kind === 'kml' && o.mediaId) ? (
        <ul className="sf-live-map-kml">
          {overlays
            .filter((o) => o.kind === 'kml' && o.mediaId)
            .map((o) => (
              <li key={o.id}>{o.label || 'KML overlay'}</li>
            ))}
        </ul>
      ) : null}
    </div>
  )
}
