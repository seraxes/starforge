'use client'

import React, { useActionState, useState } from 'react'

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
import { useDismissible } from './useDismissible'

const feedInitial: SocialFeedActionState = {}
const commentInitial: SocialCommentActionState = {}
const peopleInitial: SocialPeopleActionState = {}

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
  const hide = useHideItem()
  const [open, setOpen] = useState(false)
  const rootRef = useDismissible<HTMLDivElement>(open, () => setOpen(false))
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePostAction,
    feedInitial,
  )
  const [blockState, blockAction, blockPending] = useActionState(
    blockUserAction,
    peopleInitial,
  )
  const isAuthor = viewerUserId.trim() === authorUserId.trim()
  const canManage = isAuthor || canModerate
  const showHideBlock = !isAuthor

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
                <form
                  action={deleteAction}
                  onSubmit={(event) => {
                    if (!window.confirm('Delete this post?')) event.preventDefault()
                  }}
                >
                  <input type="hidden" name="postId" value={postId} />
                  <button type="submit" role="menuitem" disabled={deletePending}>
                    {deletePending ? 'Deleting…' : 'Delete post'}
                  </button>
                </form>
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
                <form
                  action={blockAction}
                  onSubmit={(event) => {
                    if (
                      !window.confirm(
                        `Block ${authorName}? You won’t see each other’s posts or comments.`,
                      )
                    ) {
                      event.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="userId" value={authorUserId} />
                  <button type="submit" role="menuitem" disabled={blockPending}>
                    {blockPending ? 'Blocking…' : `Block ${authorName}`}
                  </button>
                </form>
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
  const hide = useHideItem()
  const [open, setOpen] = useState(false)
  const rootRef = useDismissible<HTMLDivElement>(open, () => setOpen(false))
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteCommentAction,
    commentInitial,
  )
  const [blockState, blockAction, blockPending] = useActionState(
    blockUserAction,
    peopleInitial,
  )

  const isOwn = Boolean(viewerUserId) && viewerUserId === authorUserId
  const showHideBlock = Boolean(viewerUserId) && !isOwn

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
              <form
                action={deleteAction}
                onSubmit={(event) => {
                  if (!window.confirm('Delete this comment?')) event.preventDefault()
                }}
              >
                <input type="hidden" name="commentId" value={commentId} />
                <button type="submit" role="menuitem" disabled={deletePending}>
                  {deletePending ? 'Deleting…' : 'Delete'}
                </button>
              </form>
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
                <form
                  action={blockAction}
                  onSubmit={(event) => {
                    if (
                      !window.confirm(
                        `Block ${authorName}? You won’t see each other’s posts or comments.`,
                      )
                    ) {
                      event.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="userId" value={authorUserId} />
                  <button type="submit" role="menuitem" disabled={blockPending}>
                    {blockPending ? 'Blocking…' : `Block ${authorName}`}
                  </button>
                </form>
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
  const [editState, editAction, editPending] = useActionState(editPostAction, feedInitial)
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
