'use client'

import React, { createContext, useContext } from 'react'

import type { ContentLocaleOption } from '@/core/i18n/locale-text'

const ContentLocalesContext = createContext<ContentLocaleOption[]>([])

export function ContentLocalesProvider({
  locales,
  children,
}: {
  locales: ContentLocaleOption[]
  children: React.ReactNode
}) {
  return (
    <ContentLocalesContext.Provider value={locales}>{children}</ContentLocalesContext.Provider>
  )
}

export function useContentLocales(): ContentLocaleOption[] {
  return useContext(ContentLocalesContext)
}
