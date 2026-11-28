'use client'

import React, { createContext, useContext, type ReactNode } from 'react'

import {
  EmojiInsertButton,
  type EmojiInsertButtonProps,
} from '@/modules/rich-editor/api'

const SocialEmojiInsertContext = createContext(true)

/** Pass the rich-editor pack `emojiInsertEnabled` flag from a server page. */
export function SocialEmojiInsertProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  return (
    <SocialEmojiInsertContext.Provider value={enabled}>
      {children}
    </SocialEmojiInsertContext.Provider>
  )
}

/** Renders nothing when site-wide emoji insert is off. */
export function SocialEmojiInsertButton(props: EmojiInsertButtonProps) {
  const enabled = useContext(SocialEmojiInsertContext)
  if (!enabled) return null
  return <EmojiInsertButton {...props} />
}
