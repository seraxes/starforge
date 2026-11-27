'use client'

import React, {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'

import { PostEditForm, PostOptionsMenu } from './SocialOptionsMenu'

type PostManageContextValue = {
  postId: string
  plainBody: string
  viewerUserId: string
  authorUserId: string
  authorName: string
  canModerate: boolean
  isMuted: boolean
  editing: boolean
  setEditing: (value: boolean) => void
}

const PostManageContext = createContext<PostManageContextValue | null>(null)

function usePostManage(): PostManageContextValue {
  const value = useContext(PostManageContext)
  if (!value) {
    throw new Error('PostManage tools/body must sit inside PostManageProvider')
  }
  return value
}

/** Owns edit state so tools (header) and body can stay in layout place. */
export function PostManageProvider({
  postId,
  body,
  viewerUserId,
  authorUserId,
  authorName,
  canModerate = false,
  isMuted = false,
  children,
}: {
  postId: string
  body: string
  viewerUserId: string
  authorUserId: string
  authorName: string
  /** App admin / dev / Social staff — Edit/Delete any post. */
  canModerate?: boolean
  /** Viewer already muted this author. */
  isMuted?: boolean
  children: ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const plainBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

  return (
    <PostManageContext.Provider
      value={{
        postId,
        plainBody,
        viewerUserId,
        authorUserId,
        authorName,
        canModerate,
        isMuted,
        editing,
        setEditing,
      }}
    >
      {children}
    </PostManageContext.Provider>
  )
}

/** ··· after audience on the right of the card head (Edit/Delete/Hide/Mute/Block). */
export function PostManageTools() {
  const {
    postId,
    viewerUserId,
    authorUserId,
    authorName,
    canModerate,
    isMuted,
    setEditing,
  } = usePostManage()
  return (
    <PostOptionsMenu
      postId={postId}
      viewerUserId={viewerUserId}
      authorUserId={authorUserId}
      authorName={authorName}
      canModerate={canModerate}
      isMuted={isMuted}
      onEdit={() => setEditing(true)}
    />
  )
}

/** Body text, or the inline edit form when Edit post is chosen. */
export function PostManageBody({ children }: { children?: ReactNode }) {
  const {
    postId,
    plainBody,
    editing,
    setEditing,
    viewerUserId,
    authorUserId,
    canModerate,
  } = usePostManage()
  const isAuthor = viewerUserId.trim() === authorUserId.trim()
  const canEdit = isAuthor || canModerate

  if (canEdit && editing) {
    return (
      <PostEditForm
        postId={postId}
        plainBody={plainBody}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return <>{children}</>
}
