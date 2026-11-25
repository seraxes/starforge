'use client'

import React, { useActionState, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  blockUserAction,
  deleteCommentAction,
  deletePostAction,
  editPostAction,
  type SocialCommentActionState,
  type SocialFeedActionState,
  type SocialPeopleActionState,
} from '../actions'
import { useHideItem } from './HideableShell'
import { SocialConfirmDialog } from './SocialConfirmDialog'
import { useDismissible } from './useDismissible'

const feedInitial: SocialFeedActionState = {}
const commentInitial: SocialCommentActionState = {}
const peopleInitial: SocialPeopleActionState = {}

type ConfirmKind = 'delete' | 'block' | null

/**
 * Post ··· menu.
 * Own post: Edit + Delete.
 * Someone else’s: Hide + Block; staff also get Edit + Delete.
 */
export function PostOptionsMenu({
  postId,
  viewerUserId,
  authorUserId,
  authorName,
  canModerate = false,
  onEdit,
}: {
  postId: string
  viewerUserId: string
  authorUserId: string
  authorName: string
  /** App admin / developer / Social staff — Edit/Delete any post. */
  canModerate?: boolean
  /** Opens the inline edit form. */
  onEdit?: () => void
}) {
  const router = useRouter()
  const hide = useHideItem()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const rootRef = useDismissible<HTMLDivElement>(open, () => setOpen(false))
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePostAction,
    feedInitial,
  )
  const [blockState, blockAction, blockPending] = useActionState(
    blockUserAction,
    peopleInitial,
  )
  const [pending, startTransition] = useTransition()
  const isAuthor = viewerUserId.trim() === authorUserId.trim()
  const canManage = isAuthor || canModerate
  const showHideBlock = !isAuthor
  const busy = deletePending || blockPending || pending

  useEffect(() => {
    if (!deleteState.ok) return
    setOpen(false)
    setConfirm(null)
    router.refresh()
  }, [deleteState, router])

  useEffect(() => {
    if (!blockState.ok) return
    setOpen(false)
    setConfirm(null)
    router.refresh()
  }, [blockState, router])

  return (
    <div className="sf-social-post-menu" ref={rootRef}>
      <button
        type="button"
        className="ghost sf-social-post-menu-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Post options"
        onClick={() => setOpen((value) => !value)}
      >
        ···
      </button>
      {open ? (
        <ul className="sf-social-post-menu-list" role="menu">
          {canManage ? (
            <>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onEdit?.()
                  }}
                >
                  Edit post
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false)
                    setConfirm('delete')
                  }}
                >
                  {deletePending ? 'Deleting…' : 'Delete post'}
                </button>
              </li>
            </>
          ) : null}
          {showHideBlock ? (
            <>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    hide()
                  }}
                >
                  Hide post
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false)
                    setConfirm('block')
                  }}
                >
                  {blockPending ? 'Blocking…' : `Block ${authorName}`}
                </button>
              </li>
            </>
          ) : null}
        </ul>
      ) : null}
      {deleteState.error ? (
        <p className="admin-inline-error" role="alert">
          {deleteState.error}
        </p>
      ) : null}
      {blockState.error ? (
        <p className="admin-inline-error" role="alert">
          {blockState.error}
        </p>
      ) : null}
      <SocialConfirmDialog
        open={confirm === 'delete'}
        title="Delete post"
        message="Delete this post?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          const fd = new FormData()
          fd.set('postId', postId)
          startTransition(() => {
            void deleteAction(fd)
          })
        }}
      />
      <SocialConfirmDialog
        open={confirm === 'block'}
        title={`Block ${authorName}`}
        message={`Block ${authorName}? You won’t see each other’s posts or comments.`}
        confirmLabel="Block"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          const fd = new FormData()
          fd.set('userId', authorUserId)
          startTransition(() => {
            void blockAction(fd)
          })
        }}
      />
    </div>
  )
}

/**
 * Reply ··· on the right.
 * Own / staff: Edit/Delete when allowed.
 * Someone else’s: Hide + Block (kept even when staff can also edit).
 */
export function CommentOptionsMenu({
  commentId,
  authorUserId,
  authorName,
  viewerUserId,
  canEdit,
  canDelete,
  onEdit,
}: {
  commentId: string
  authorUserId: string
  authorName: string
  viewerUserId: string | null
  canEdit: boolean
  canDelete: boolean
  onEdit?: () => void
}) {
  const router = useRouter()
  const hide = useHideItem()
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmKind>(null)
  const rootRef = useDismissible<HTMLDivElement>(open, () => setOpen(false))
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCommentAction,
    commentInitial,
  )
  const [blockState, blockAction, blockPending] = useActionState(
    blockUserAction,
    peopleInitial,
  )
  const [pending, startTransition] = useTransition()

  const isOwn = Boolean(viewerUserId) && viewerUserId === authorUserId
  const showHideBlock = Boolean(viewerUserId) && !isOwn
  const busy = deletePending || blockPending || pending

  useEffect(() => {
    if (!deleteState.ok) return
    setOpen(false)
    setConfirm(null)
    router.refresh()
  }, [deleteState, router])

  useEffect(() => {
    if (!blockState.ok) return
    setOpen(false)
    setConfirm(null)
    router.refresh()
  }, [blockState, router])

  if (!canEdit && !canDelete && !showHideBlock) return null

  return (
    <div className="sf-social-post-menu sf-social-comment-menu" ref={rootRef}>
      <button
        type="button"
        className="ghost sf-social-post-menu-toggle"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Comment options"
        onClick={() => setOpen((value) => !value)}
      >
        ···
      </button>
      {open ? (
        <ul className="sf-social-post-menu-list" role="menu">
          {canEdit ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onEdit?.()
                }}
              >
                Edit
              </button>
            </li>
          ) : null}
          {canDelete ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => {
                  setOpen(false)
                  setConfirm('delete')
                }}
              >
                {deletePending ? 'Deleting…' : 'Delete'}
              </button>
            </li>
          ) : null}
          {showHideBlock ? (
            <>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    hide()
                  }}
                >
                  Hide
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false)
                    setConfirm('block')
                  }}
                >
                  {blockPending ? 'Blocking…' : `Block ${authorName}`}
                </button>
              </li>
            </>
          ) : null}
        </ul>
      ) : null}
      {deleteState.error ? (
        <p className="admin-inline-error" role="alert">
          {deleteState.error}
        </p>
      ) : null}
      {blockState.error ? (
        <p className="admin-inline-error" role="alert">
          {blockState.error}
        </p>
      ) : null}
      <SocialConfirmDialog
        open={confirm === 'delete'}
        title="Delete comment"
        message="Delete this comment?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          const fd = new FormData()
          fd.set('commentId', commentId)
          startTransition(() => {
            void deleteAction(fd)
          })
        }}
      />
      <SocialConfirmDialog
        open={confirm === 'block'}
        title={`Block ${authorName}`}
        message={`Block ${authorName}? You won’t see each other’s posts or comments.`}
        confirmLabel="Block"
        cancelLabel="Cancel"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          const fd = new FormData()
          fd.set('userId', authorUserId)
          startTransition(() => {
            void blockAction(fd)
          })
        }}
      />
    </div>
  )
}

/** Inline post body editor opened from ··· Edit post. */
export function PostEditForm({
  postId,
  plainBody,
  onCancel,
}: {
  postId: string
  plainBody: string
  onCancel: () => void
}) {
  const router = useRouter()
  const [editState, editAction, editPending] = useActionState(editPostAction, feedInitial)
  const onCancelRef = React.useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!editState.ok) return
    onCancelRef.current()
    router.refresh()
  }, [editState, router])

  return (
    <form action={editAction} className="sf-social-post-edit">
      <input type="hidden" name="postId" value={postId} />
      <textarea
        name="body"
        className="sf-social-stage-caption"
        rows={3}
        maxLength={8000}
        defaultValue={plainBody}
        disabled={editPending}
        aria-label="Edit post"
        required
      />
      <div className="sf-social-post-edit-actions">
        <button type="submit" className="secondary" disabled={editPending}>
          {editPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="ghost" disabled={editPending} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {editState.error ? (
        <p className="admin-inline-error" role="alert">
          {editState.error}
        </p>
      ) : null}
    </form>
  )
}
