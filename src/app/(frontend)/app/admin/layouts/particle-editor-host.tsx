'use client'

import React, { useEffect, useState, type ComponentType } from 'react'

import type { ParticleEditorProps } from '@/core/modules/particles/editor-props'
import { particleEditorLoaders } from '@/generated/module-registry'

/**
 * Loads the particle cog editor from the generated manifest registry (M1).
 * New particles contribute `editorImportPath` — Core does not switch on moduleId.
 */
export function ParticleEditorHost(props: ParticleEditorProps) {
  const moduleId = props.slot.moduleId
  const [Editor, setEditor] = useState<ComponentType<ParticleEditorProps> | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const entry = particleEditorLoaders.find((row) => row.id === moduleId)
    if (!entry) {
      setEditor(null)
      setStatus('missing')
      return
    }
    setStatus('loading')
    entry
      .load()
      .then((Loaded) => {
        if (cancelled) return
        setEditor(() => Loaded as ComponentType<ParticleEditorProps>)
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setEditor(null)
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [moduleId])

  if (status === 'missing') {
    return (
      <p className="layout-muted">
        No particle-specific config for <code>{moduleId}</code>.
      </p>
    )
  }
  if (status === 'error') {
    return (
      <p className="admin-inline-error" role="alert">
        Could not load the editor for <code>{moduleId}</code>.
      </p>
    )
  }
  if (status === 'loading' || !Editor) {
    return <p className="layout-muted">Loading editor…</p>
  }
  return <Editor {...props} />
}
