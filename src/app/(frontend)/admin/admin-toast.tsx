'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

export type AdminToastKind = 'success' | 'error'

type ToastItem = {
  id: number
  kind: AdminToastKind
  message: string
}

type AdminToastApi = {
  /** Global top success toast — default copy “Saved”. */
  notifySaved: (message?: string) => void
  /** Error toast (also OK to keep local inline errors). */
  notifyError: (message: string) => void
}

const AdminToastContext = createContext<AdminToastApi | null>(null)

const TOAST_MS = 2200

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const push = useCallback((kind: AdminToastKind, message: string) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev.filter((t) => t.kind !== kind || t.message !== message), { id, kind, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_MS)
  }, [])

  const api = useMemo<AdminToastApi>(
    () => ({
      notifySaved: (message = 'Saved') => push('success', message || 'Saved'),
      notifyError: (message) => push('error', message || 'Something went wrong'),
    }),
    [push],
  )

  return (
    <AdminToastContext.Provider value={api}>
      {children}
      <div className="admin-toast-host" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={
              toast.kind === 'success' ? 'admin-toast admin-toast-success' : 'admin-toast admin-toast-error'
            }
            role={toast.kind === 'error' ? 'alert' : 'status'}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </AdminToastContext.Provider>
  )
}

export function useAdminToast(): AdminToastApi {
  const ctx = useContext(AdminToastContext)
  if (!ctx) {
    // Safe no-op outside provider (tests / partial mounts).
    return {
      notifySaved: () => undefined,
      notifyError: () => undefined,
    }
  }
  return ctx
}

/** Fire Saved toast when a server-action style result flips to ok. */
export function useNotifySavedOnOk(
  state: { ok?: boolean; error?: string; message?: string } | null | undefined,
  options?: { successMessage?: string; toastErrors?: boolean },
) {
  const { notifySaved, notifyError } = useAdminToast()
  const seenRef = useRef<typeof state>(null)
  const successMessage = options?.successMessage ?? 'Saved'
  const toastErrors = Boolean(options?.toastErrors)

  useEffect(() => {
    if (!state || state === seenRef.current) return
    seenRef.current = state
    if (state.ok) notifySaved(successMessage)
    else if (state.error && toastErrors) notifyError(state.error)
  }, [state, notifySaved, notifyError, successMessage, toastErrors])
}
