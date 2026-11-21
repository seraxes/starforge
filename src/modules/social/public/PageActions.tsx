'use client'

import React, { useActionState } from 'react'

import {
  addPageAdminAction,
  createPageAction,
  createPageWallPostAction,
  likePageAction,
  unlikePageAction,
  type SocialPageActionState,
} from '../actions'

const initial: SocialPageActionState = {}

export function CreatePageForm() {
  const [state, action, pending] = useActionState(createPageAction, initial)
  return (
    <form action={action} className="sf-social-create-page">
      <label className="settings-field">
        <span>Name</span>
        <input type="text" name="name" maxLength={120} required disabled={pending} />
      </label>
      <label className="settings-field">
        <span>Description</span>
        <textarea name="description" rows={2} maxLength={2000} disabled={pending} />
      </label>
      <label className="settings-field">
        <span>Site page id (optional)</span>
        <input
          type="text"
          name="sitePageId"
          maxLength={120}
          disabled={pending}
          placeholder="Editorial page id"
        />
      </label>
      <div className="admin-control-row">
        <button type="submit" className="gantry-btn gantry-btn-primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create page'}
        </button>
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.slug ? (
        <p className="admin-inline-ok">Page created.</p>
      ) : null}
    </form>
  )
}

export function LikePageButton({ pageId }: { pageId: string }) {
  const [state, action, pending] = useActionState(likePageAction, initial)
  return (
    <form action={action}>
      <input type="hidden" name="pageId" value={pageId} />
      <button type="submit" className="gantry-btn gantry-btn-primary" disabled={pending}>
        {pending ? 'Liking…' : 'Like page'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function UnlikePageButton({ pageId }: { pageId: string }) {
  const [state, action, pending] = useActionState(unlikePageAction, initial)
  return (
    <form action={action}>
      <input type="hidden" name="pageId" value={pageId} />
      <button type="submit" className="gantry-btn" disabled={pending}>
        {pending ? 'Removing…' : 'Unlike'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function AddPageAdminForm({ pageId }: { pageId: string }) {
  const [state, action, pending] = useActionState(addPageAdminAction, initial)
  return (
    <form action={action} className="sf-social-add-page-admin">
      <input type="hidden" name="pageId" value={pageId} />
      <label className="settings-field">
        <span>Add admin (user id)</span>
        <input type="text" name="targetUserId" required disabled={pending} />
      </label>
      <div className="admin-control-row">
        <button type="submit" className="gantry-btn" disabled={pending}>
          {pending ? 'Adding…' : 'Add admin'}
        </button>
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function PageWallComposer({ pageId }: { pageId: string }) {
  const [state, action, pending] = useActionState(createPageWallPostAction, initial)
  return (
    <form action={action} className="sf-social-page-wall-composer">
      <input type="hidden" name="pageId" value={pageId} />
      <label className="settings-field">
        <span>New wall post</span>
        <textarea name="body" rows={3} required disabled={pending} />
      </label>
      <div className="admin-control-row">
        <button type="submit" className="gantry-btn gantry-btn-primary" disabled={pending}>
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
