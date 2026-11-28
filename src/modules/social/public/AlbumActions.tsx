'use client'

import React, { useActionState, useState } from 'react'

import { MemberMediaPicker } from '@/modules/media/api'

import {
  addAlbumItemAction,
  createAlbumAction,
  type SocialAlbumActionState,
} from '../actions'
import type { AlbumItemRecord, AlbumOwnerType, AlbumRecord } from '../albums'

const initial: SocialAlbumActionState = {}

export function CreateAlbumForm({
  ownerType,
  ownerId,
}: {
  ownerType: AlbumOwnerType
  ownerId: string
}) {
  const [state, action, pending] = useActionState(createAlbumAction, initial)
  const [coverMediaId, setCoverMediaId] = useState('')
  return (
    <form action={action} className="sf-social-create-album">
      <input type="hidden" name="ownerType" value={ownerType} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="coverMediaId" value={coverMediaId} />
      <label className="settings-field">
        <span>Album title</span>
        <input type="text" name="title" maxLength={120} required disabled={pending} />
      </label>
      <div className="settings-field settings-field-wide">
        <span>Cover (optional)</span>
        <MemberMediaPicker
          label="Choose cover"
          value={coverMediaId}
          onChange={setCoverMediaId}
          context="social-album-cover"
          chrome="public"
          shape="wide"
          disabled={pending}
          hint="File stays in Media."
        />
      </div>
      <button type="submit" className="sf-social-btn sf-social-btn-primary" disabled={pending}>
        {pending ? 'Creating…' : 'Create album'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function AddAlbumItemForm({ albumId }: { albumId: string }) {
  const [state, action, pending] = useActionState(addAlbumItemAction, initial)
  const [mediaId, setMediaId] = useState('')
  return (
    <form action={action} className="sf-social-add-album-item">
      <input type="hidden" name="albumId" value={albumId} />
      <input type="hidden" name="mediaId" value={mediaId} />
      <div className="settings-field settings-field-wide">
        <span>Add photo or video</span>
        <MemberMediaPicker
          key={mediaId || `empty-album-${albumId}`}
          label="Choose file"
          value={mediaId}
          onChange={setMediaId}
          context="social-album-item"
          chrome="public"
          shape="wide"
          disabled={pending}
          hint="File stays in Media."
        />
      </div>
      <button type="submit" className="sf-social-btn sf-social-btn-primary" disabled={pending || !mediaId}>
        {pending ? 'Adding…' : 'Add to album'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function AlbumList({
  albums,
  itemsByAlbum,
  canManage,
}: {
  albums: AlbumRecord[]
  itemsByAlbum: Map<string, AlbumItemRecord[]>
  canManage: boolean
}) {
  if (albums.length === 0) {
    return <p className="layout-muted">No albums yet.</p>
  }
  return (
    <ul className="sf-social-album-list">
      {albums.map((album) => {
        const items = itemsByAlbum.get(album.id) ?? []
        return (
          <li key={album.id} className="sf-social-album">
            <h3 className="sf-social-section-heading">{album.title}</h3>
            {album.coverMediaId ? (
              <p>
                <a
                  href={`/api/media/${encodeURIComponent(album.coverMediaId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Cover
                </a>
              </p>
            ) : null}
            {items.length === 0 ? (
              <p className="layout-muted">No files yet.</p>
            ) : (
              <ul className="sf-social-album-items">
                {items.map((item) => (
                  <li key={item.id}>
                    <a
                      href={`/api/media/${encodeURIComponent(item.mediaId)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.mediaId}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {canManage ? <AddAlbumItemForm albumId={album.id} /> : null}
          </li>
        )
      })}
    </ul>
  )
}
