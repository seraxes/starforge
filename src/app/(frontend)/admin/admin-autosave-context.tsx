'use client'

import React, { createContext, useContext } from 'react'

import { DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS } from '@/core/settings/defaults'

const AdminAutosaveDebounceContext = createContext<number>(DEFAULT_ADMIN_AUTOSAVE_DEBOUNCE_MS)

/** Provide Site Settings → admin autosave debounce (ms) to Core admin client trees. */
export function AdminAutosaveProvider({
  delayMs,
  children,
}: {
  delayMs: number
  children: React.ReactNode
}) {
  return (
    <AdminAutosaveDebounceContext.Provider value={delayMs}>
      {children}
    </AdminAutosaveDebounceContext.Provider>
  )
}

/** Active Core admin autosave debounce from Site Settings (fallback default). */
export function useAdminAutosaveDebounceMs(): number {
  return useContext(AdminAutosaveDebounceContext)
}
