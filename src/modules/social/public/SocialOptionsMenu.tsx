'use client'

import React, { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { EmojiInsertButton } from '@/modules/rich-editor/api'

import {
  blockUserAction,
  deleteCommentAction,
  deletePostAction,
  editPostAction,
  muteUserAction,
  unmuteUserAction,
  type SocialCommentActionState,
  type SocialFeedActionState,
  type SocialPeopleActionState,
  type SocialQuietActionState,
} from '../actions'
import { useHideItem } from './HideableShell'
import { useQuietHidePost } from './QuietPostShell'
import { SocialConfirmDialog } from './SocialConfirmDialog'
import { useDismissible } from './useDismissible'

const feedInitial: SocialFeedActionState = {}
const commentInitial: SocialCommentActionState = {}
const peopleInitial: SocialPeopleActionState = {}
const quietInitial: SocialQuietActionState = {}

type ConfirmKind = 'delete' | 'block' | null

/**
 * Post ··· menu.
 * Own post: Edit + Delete.
 * Someone else’s: Hide this post + Mute + Block; staff also get Edit + Delete.
 */
export function PostOptionsMenu({
  postId,
  viewerUserId,
  authorUserId,
  authorName,
  canModerate = false,
  isMuted = false,
  onEdit,
}: {
  postId: string
  viewerUserId: string
  authorUserId: string
  authorName: string
  /** App admin / developer / Social staff — Edit/Delete any post. */
  canModerate?: boolean
  /** Viewer already muted this author. */
  isMuted?: boolean
  /** Opens the inline edit form. */
  onEdit?: () => void
}) {
  const router = useRouter()
  const hide = useQuietHidePost()
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
  const [muteState, muteAction, mutePending] = useActionState(
    muteUserAction,
    quietInitial,
  )
  const [unmuteState, unmuteAction, unmutePending] = useActionState(
    unmuteUserAction,
    quietInitial,
  )
  const [pending, startTransition] = useTransition()
  const isAuthor = viewerUserId.trim() === authorUserId.trim()
  const canManage = isAuthor || canModerate
  const showQuietTools = !isAuthor
  const busy =
    deletePending || blockPending || mutePending || unmutePending || pending

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

  useEffect(() => {
    if (!muteState.ok && !unmuteState.ok) return
    setOpen(false)
    router.refresh()
  }, [muteState, unmuteState, router])

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
          {showQuietTools ? (
            <>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false)
                    hide()
                  }}
                >
                  Hide this post
                </button>
              </li>
              <li role="none">
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  onClick={() => {
                    setOpen(false)
                    const fd = new FormData()
                    fd.set('userId', authorUserId)
                    startTransition(() => {
                      void (isMuted ? unmuteAction(fd) : muteAction(fd))
                    })
                  }}
                >
                  {mutePending || unmutePending
                    ? isMuted
                      ? 'Unmuting…'
                      : 'Muting…'
                    : isMuted
                      ? `Unmute ${authorName}`
                      : `Mute ${authorName}`}
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
      {muteState.error || unmuteState.error ? (
        <p className="admin-inline-error" role="alert">
          {muteState.error || unmuteState.error}
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
 * Someone else’s: Hide + Mute + Block (kept even when staff can also edit).
 */
export function CommentOptionsMenu({
  commentId,
  authorUserId,
  authorName,
  viewerUserId,
  canEdit,
  canDelete,
  isMuted = false,
  onEdit,
}: {
  commentId: string
  authorUserId: string
  authorName: string
  viewerUserId: string | null
  canEdit: boolean
  canDelete: boolean
  isMuted?: boolean
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
  const [muteState, muteAction, mutePending] = useActionState(
    muteUserAction,
    quietInitial,
  )
  const [unmuteState, unmuteAction, unmutePending] = useActionState(
    unmuteUserAction,
    quietInitial,
  )
  const [pending, startTransition] = useTransition()

  const isOwn = Boolean(viewerUserId) && viewerUserId === authorUserId
  const showQuietTools = Boolean(viewerUserId) && !isOwn
  const busy =
    deletePending || blockPending || mutePending || unmutePending || pending

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

  useEffect(() => {
    if (!muteState.ok && !unmuteState.ok) return
    setOpen(false)
    router.refresh()
  }, [muteState, unmuteState, router])

  if (!canEdit && !canDelete && !showQuietTools) return null

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
          {showQuietTools ? (
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
                    const fd = new FormData()
                    fd.set('userId', authorUserId)
                    startTransition(() => {
                      void (isMuted ? unmuteAction(fd) : muteAction(fd))
                    })
                  }}
                >
                  {mutePending || unmutePending
                    ? isMuted
                      ? 'Unmuting…'
                      : 'Muting…'
                    : isMuted
                      ? `Unmute ${authorName}`
                      : `Mute ${authorName}`}
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
      {muteState.error || unmuteState.error ? (
        <p className="admin-inline-error" role="alert">
          {muteState.error || unmuteState.error}
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
  const bodyRef = useRef<HTMLTextAreaElement>(null)
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
        ref={bodyRef}
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
        <EmojiInsertButton disabled={editPending} targetRef={bodyRef} />
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
