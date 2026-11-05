'use client'

import React, { createContext, useContext } from 'react'

const LayoutOutlineContext = createContext<string>('default')

/** Active outline id for the Layout canvas (threaded into every save form). */
export function LayoutOutlineProvider({
  layoutId,
  children,
}: {
  layoutId: string
  children: React.ReactNode
}) {
  return (
    <LayoutOutlineContext.Provider value={layoutId}>{children}</LayoutOutlineContext.Provider>
  )
}

export function useLayoutOutlineId(): string {
  return useContext(LayoutOutlineContext)
}

/** Hidden field so server actions know which outline to mutate. */
export function LayoutIdField() {
  const layoutId = useLayoutOutlineId()
  return <input type="hidden" name="layoutId" value={layoutId} />
}
