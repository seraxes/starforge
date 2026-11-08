import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { getEnabledPublicLocaleEntries } from '@/core/i18n/enabled'
import { getMapProvider } from '@/core/maps'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { saveProfileAdminAction } from '../actions'
import { ProfileEditor } from '../components/ProfileEditor'
import { buildEditorModel } from '../form'
import { loadProfilesModuleSettings } from '../settings.server'
import { ensureProfile } from '../store'
import { ProfilesAdminNav } from './profiles-admin-nav'

export const metadata = {
  title: 'Edit profile — Starforge',
  description: 'Member profile editor (Profiles module).',
}

type Params = Promise<{ userId: string }>

/** product:profiles — admin edit of one member (same editor the member sees). */
export default async function ProfileEditPage({ params }: { params: Params }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.profiles)) {
    redirect('/admin/settings')
  }

  const { userId } = await params
  const id = (userId || '').trim()
  if (!id) notFound()

  const users = await db
    .select({ email: sfUsers.email, name: sfUsers.name })
    .from(sfUsers)
    .where(eq(sfUsers.id, id))
    .limit(1)
  const user = users[0]
  if (!user) notFound()

  const mapsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.maps)
  const [record, loaded, locales, mapClientConfig] = await Promise.all([
    ensureProfile(id),
    loadProfilesModuleSettings(),
    getEnabledPublicLocaleEntries(),
    mapsEnabled ? getMapProvider().then((p) => p.clientConfig()) : Promise.resolve(null),
  ])
  if (!record) notFound()

  const model = buildEditorModel({
    record,
    email: user.email,
    settings: loaded.settings,
    locales,
    actor: 'admin',
  })

  return (
    <section className="admin-section admin-layouts-full">
      <ProfilesAdminNav active="profiles" />
      <p className="sf-events-editor-back">
        <Link href="/admin/profiles">← Profiles</Link>
      </p>
      <h2>
        {record.displayName || user.name}{' '}
        <span className="layout-muted">@{record.handle}</span>
      </h2>
      <p className="lede admin-lede">
        {user.email} · profile is <strong>{record.status}</strong>. Admin edits bypass the
        username cooldown and can pick any image from the Media library.
      </p>
      <ProfileEditor
        model={model}
        action={saveProfileAdminAction}
        chrome="admin"
        imagePicker="library"
        cancelHref="/admin/profiles"
        includeUserId
        mapClientConfig={mapClientConfig}
        viewHrefPrefix="/u/"
      />
    </section>
  )
}
