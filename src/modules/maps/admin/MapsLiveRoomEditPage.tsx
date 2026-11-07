import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { findEventById } from '@/modules/events/store'
import { listEventsUserOptions } from '@/modules/events/user-options'

import {
  findMapRoomById,
  listOverlaysForRoom,
  listRoomAdminUserIds,
  listTeamMemberUserIds,
  listTeamsForRoom,
} from '../store'
import { MapsAdminNav } from './maps-admin-nav'
import { MapsRoomEditor } from './maps-room-editor'

export const metadata = {
  title: 'Edit live map — Starforge',
}

type Params = Promise<{ roomId: string }>

/** product:maps room editor — teams, roster, overlays. */
export default async function MapsLiveRoomEditPage({
  params,
}: {
  params: Params
}) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.maps)) {
    redirect('/admin/settings')
  }

  const { roomId } = await params
  const room = await findMapRoomById(roomId)
  if (!room) notFound()

  const [event, admins, teams, overlays, users] = await Promise.all([
    findEventById(room.eventId),
    listRoomAdminUserIds(room.id),
    listTeamsForRoom(room.id),
    listOverlaysForRoom(room.id),
    listEventsUserOptions(),
  ])

  const teamsWithMembers = await Promise.all(
    teams.map(async (team) => ({
      ...team,
      memberIds: await listTeamMemberUserIds(team.id),
    })),
  )

  return (
    <section className="admin-section admin-layouts-full sf-maps-admin">
      <MapsAdminNav
        active="edit"
        editHref={`/admin/maps/${room.id}`}
        editLabel={room.title}
      />
      <h2>{room.title}</h2>
      <p className="lede admin-lede">
        Event:{' '}
        {event ? (
          <Link href={`/admin/events/${event.id}`}>{event.title}</Link>
        ) : (
          room.eventId
        )}
        . Teams + roster — same-team only on the live map. List:{' '}
        <Link href="/admin/maps">Live maps</Link>.
      </p>
      <MapsRoomEditor
        room={{
          id: room.id,
          title: room.title,
          active: room.active,
          ownerUserId: room.ownerUserId,
          eventId: room.eventId,
        }}
        adminIds={admins}
        teams={teamsWithMembers.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          memberIds: t.memberIds,
          ticketTierId: t.ticketTierId,
        }))}
        overlays={overlays.map((o) => ({
          id: o.id,
          kind: o.kind,
          pointKind: o.pointKind,
          label: o.label,
          latitude: o.latitude,
          longitude: o.longitude,
          mediaId: o.mediaId,
        }))}
        users={users}
      />
    </section>
  )
}
