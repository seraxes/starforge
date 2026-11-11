'use client'

import { html } from '@codemirror/lang-html'
import { EditorContent, useEditor } from '@tiptap/react'
import CodeMirror from '@uiw/react-codemirror'
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'

import { starforgeAdminCmTheme } from '@/components/admin/starforge-admin-cm-theme'

import { CalloutInsertDialog } from './CalloutInsertDialog'
import { createRichEditorExtensions, type RichEditorPreset } from './extensions'
import { LinkInsertDialog } from './LinkInsertDialog'
import { parseVideoInput } from './nodes/video'
import { sanitizeEmailHtml, sanitizeRichHtml } from './sanitize'

function sanitizeEditorHtml(preset: RichEditorPreset, raw: string | null | undefined): string {
  return preset === 'email' ? sanitizeEmailHtml(raw) : sanitizeRichHtml(raw)
}

/** Value returned by the caller-supplied media picker (`@/modules/media/api`). */
export type RichEditorMediaValue = {
  mediaId: string
  url?: string
  alt?: string
}

/** Props this editor passes into that picker. */
export type RichEditorMediaPickerProps = {
  label?: string
  value: RichEditorMediaValue
  onChange: (next: RichEditorMediaValue) => void
  defaultFolder?: string
  defaultPurpose?: string
  disabled?: boolean
  includeHiddenInputs?: boolean
  allowUrlFallback?: boolean
  hint?: string
}

export type RichEditorProps = {
  /** When set, writes sanitized HTML into a hidden input for FormData actions. */
  name?: string
  value?: string
  defaultValue?: string
  onChange?: (html: string) => void
  disabled?: boolean
  /**
   * Module gate (Site Settings → Modules → Rich editor).
   * When false, falls back to a plain textarea (module off).
   * Default true — pass `isRichEditorEnabled(settings)` from the host page.
   */
  enabled?: boolean
  preset?: RichEditorPreset
  placeholder?: string
  className?: string
  label?: string
  /** Show Media picker for image insert (default true on full + email presets). */
  allowImages?: boolean
  /**
   * Shared library picker for image, gallery, and video-from-media.
   * Pass `MediaPicker` from `@/modules/media/api`. Those inserts stay off when omitted.
   */
  MediaPicker?: React.ComponentType<RichEditorMediaPickerProps>
}

type EditorMode = 'visual' | 'html'
/** Inline insert panels — Image / Gallery / Video share the same chrome under the toolbar. */
type InsertPanelMode = 'image' | 'gallery' | 'video' | null
type VideoSource = 'media' | 'embed'

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Orange', value: '#e07a3d' },
  { label: 'Blue', value: '#3d7ae0' },
  { label: 'Green', value: '#2f9e64' },
  { label: 'Red', value: '#e22e2e' },
  { label: 'Muted', value: '#8899aa' },
]

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`gantry-toolbar-btn gantry-toolbar-btn-muted${active ? ' is-active' : ''}`}
      disabled={disabled}
      aria-pressed={active ? true : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

/**
 * Shared TipTap rich editor for module content fields.
 * Canonical value = sanitized HTML string. Visual ↔ HTML source modes.
 * Image insert uses the `MediaPicker` passed by the caller.
 */
export function RichEditor({
  name,
  value,
  defaultValue = '',
  onChange,
  disabled,
  enabled = true,
  preset = 'full',
  placeholder,
  className,
  label,
  allowImages,
  MediaPicker: MediaPickerComponent,
}: RichEditorProps) {
  const labelId = useId()
  const imagesEnabled =
    Boolean(MediaPickerComponent) && (allowImages ?? (preset === 'full' || preset === 'email'))
  const [htmlValue, setHtmlValue] = useState(() =>
    sanitizeEditorHtml(preset, value ?? defaultValue),
  )
  const [mode, setMode] = useState<EditorMode>('visual')
  const [pickerMode, setPickerMode] = useState<InsertPanelMode>(null)
  const [videoSource, setVideoSource] = useState<VideoSource>('media')
  const [videoUrl, setVideoUrl] = useState('')
  const [videoError, setVideoError] = useState<string | null>(null)
  const [calloutDialogOpen, setCalloutDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const cmExtensions = useMemo(() => [html(), ...starforgeAdminCmTheme], [])

  const emit = useCallback(
    (next: string) => {
      const safe = sanitizeEditorHtml(preset, next)
      setHtmlValue(safe)
      onChange?.(safe)
    },
    [onChange, preset],
  )

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled && enabled && mode === 'visual',
    extensions: createRichEditorExtensions({ preset, placeholder }),
    content: sanitizeEditorHtml(preset, value ?? defaultValue) || '',
    editorProps: {
      attributes: {
        class: 'sf-rich-editor-prose',
        ...(label ? { 'aria-labelledby': labelId } : {}),
      },
    },
    onUpdate: ({ editor: ed }) => {
      emit(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled && enabled && mode === 'visual')
  }, [editor, disabled, enabled, mode])

  useEffect(() => {
    if (value === undefined || !editor) return
    const safe = sanitizeEditorHtml(preset, value)
    if (safe === editor.getHTML()) return
    editor.commands.setContent(safe || '', { emitUpdate: false })
    setHtmlValue(safe)
  }, [value, editor, preset])

  const switchToHtml = () => {
    if (editor) {
      const current = sanitizeEditorHtml(preset, editor.getHTML())
      setHtmlValue(current)
    }
    setMode('html')
    setPickerMode(null)
    setVideoError(null)
    setCalloutDialogOpen(false)
    setLinkDialogOpen(false)
  }

  const switchToVisual = () => {
    const safe = sanitizeEditorHtml(preset, htmlValue)
    setHtmlValue(safe)
    onChange?.(safe)
    if (editor) {
      editor.commands.setContent(safe || '', { emitUpdate: false })
    }
    setMode('visual')
  }

  const busy = disabled || !enabled || (mode === 'visual' && !editor)

  if (!enabled) {
    return (
      <div className={['sf-rich-editor', 'sf-rich-editor-fallback', className].filter(Boolean).join(' ')}>
        {label ? (
          <label className="sf-rich-editor-label" htmlFor={labelId}>
            {label}
          </label>
        ) : null}
        <p className="sf-rich-editor-fallback-hint layout-muted">
          Rich editor module is off — plain text/HTML field. Enable under Site Settings → Modules.
        </p>
        <textarea
          id={labelId}
          name={name}
          rows={8}
          defaultValue={htmlValue}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => emit(e.target.value)}
        />
      </div>
    )
  }

  return (
    <div
      className={['sf-rich-editor', className].filter(Boolean).join(' ')}
      data-disabled={busy ? '1' : '0'}
      data-mode={mode}
    >
      {label ? (
        <span id={labelId} className="sf-rich-editor-label">
          {label}
        </span>
      ) : null}

      <div className="sf-rich-editor-mode" role="tablist" aria-label="Editor mode">
        <ToolbarButton
          label="Visual"
          disabled={disabled}
          active={mode === 'visual'}
          onClick={() => {
            if (mode === 'html') switchToVisual()
          }}
        />
        <ToolbarButton
          label="HTML"
          disabled={disabled}
          active={mode === 'html'}
          onClick={() => {
            if (mode === 'visual') switchToHtml()
          }}
        />
      </div>

      {mode === 'visual' ? (
        <>
          <div className="sf-rich-editor-toolbar" role="toolbar" aria-label="Formatting">
            <ToolbarButton
              label="H2"
              disabled={busy}
              active={editor?.isActive('heading', { level: 2 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            />
            <ToolbarButton
              label="H3"
              disabled={busy}
              active={editor?.isActive('heading', { level: 3 })}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            />
            {preset === 'full' ? (
              <ToolbarButton
                label="H1"
                disabled={busy}
                active={editor?.isActive('heading', { level: 1 })}
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
              />
            ) : null}
            <ToolbarButton
              label="B"
              disabled={busy}
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              label="I"
              disabled={busy}
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              label="U"
              disabled={busy}
              active={editor?.isActive('underline')}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <ToolbarButton
              label="• List"
              disabled={busy}
              active={editor?.isActive('bulletList')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            />
            <ToolbarButton
              label="1. List"
              disabled={busy}
              active={editor?.isActive('orderedList')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            />
            <ToolbarButton
              label="Link"
              disabled={busy}
              active={linkDialogOpen || editor?.isActive('link')}
              onClick={() => {
                if (!editor) return
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run()
                  return
                }
                setLinkDialogOpen(true)
              }}
            />
            <ToolbarButton
              label="Left"
              disabled={busy}
              active={editor?.isActive({ textAlign: 'left' })}
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            />
            <ToolbarButton
              label="Center"
              disabled={busy}
              active={editor?.isActive({ textAlign: 'center' })}
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            />
            {preset === 'full' ? (
              <>
                <ToolbarButton
                  label="Callout"
                  disabled={busy}
                  active={calloutDialogOpen || editor?.isActive('sfCallout')}
                  onClick={() => setCalloutDialogOpen(true)}
                />
                <label className="sf-rich-editor-color">
                  <span className="sf-rich-editor-color-label">Color</span>
                  <select
                    disabled={busy}
                    aria-label="Text color"
                    value={
                      TEXT_COLORS.find((c) => c.value && editor?.isActive('textStyle', { color: c.value }))
                        ?.value ?? ''
                    }
                    onChange={(e) => {
                      const next = e.target.value
                      if (!editor) return
                      if (!next) {
                        editor.chain().focus().unsetColor().run()
                        return
                      }
                      editor.chain().focus().setColor(next).run()
                    }}
                  >
                    {TEXT_COLORS.map((c) => (
                      <option key={c.label} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ToolbarButton
                  label="Video"
                  disabled={busy}
                  active={pickerMode === 'video' || editor?.isActive('sfVideo')}
                  onClick={() => {
                    setPickerMode((m) => (m === 'video' ? null : 'video'))
                    setVideoError(null)
                    setVideoUrl('')
                    setVideoSource(MediaPickerComponent ? 'media' : 'embed')
                  }}
                />
              </>
            ) : null}
            {imagesEnabled ? (
              <>
                <ToolbarButton
                  label="Image"
                  disabled={busy}
                  active={pickerMode === 'image'}
                  onClick={() =>
                    setPickerMode((m) => (m === 'image' ? null : 'image'))
                  }
                />
                {preset === 'full' ? (
                  <ToolbarButton
                    label="Gallery"
                    disabled={busy}
                    active={pickerMode === 'gallery' || editor?.isActive('sfGallery')}
                    onClick={() =>
                      setPickerMode((m) => (m === 'gallery' ? null : 'gallery'))
                    }
                  />
                ) : null}
              </>
            ) : null}
          </div>

          {pickerMode === 'image' || pickerMode === 'gallery' || pickerMode === 'video' ? (
            <div className="sf-rich-editor-media">
              {pickerMode === 'video' ? (
                <>
                  <div className="admin-inline-actions" role="tablist" aria-label="Video source">
                    {MediaPickerComponent ? (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={videoSource === 'media'}
                        className={`gantry-toolbar-btn gantry-toolbar-btn-muted${videoSource === 'media' ? ' is-active' : ''}`}
                        disabled={busy}
                        onClick={() => {
                          setVideoSource('media')
                          setVideoError(null)
                        }}
                      >
                        Media library
                      </button>
                    ) : null}
                    <button
                      type="button"
                      role="tab"
                      aria-selected={videoSource === 'embed' || !MediaPickerComponent}
                      className={`gantry-toolbar-btn gantry-toolbar-btn-muted${videoSource === 'embed' || !MediaPickerComponent ? ' is-active' : ''}`}
                      disabled={busy}
                      onClick={() => {
                        setVideoSource('embed')
                        setVideoError(null)
                      }}
                    >
                      YouTube / Vimeo
                    </button>
                  </div>
                  {videoError ? (
                    <p className="admin-inline-error" role="alert">
                      {videoError}
                    </p>
                  ) : null}
                  {videoSource === 'media' && MediaPickerComponent ? (
                    <MediaPickerComponent
                      label="Insert video from Media"
                      value={{ mediaId: '', url: '', alt: '' }}
                      defaultFolder="general"
                      defaultPurpose="other"
                      disabled={busy}
                      includeHiddenInputs={false}
                      allowUrlFallback={false}
                      hint="Same Media Manager as Image / Gallery (local disk or Spaces). Prefer MP4 / WebM."
                      onChange={(next) => {
                        if (!editor || !next.url) {
                          setVideoError('Selected media has no URL.')
                          return
                        }
                        setVideoError(null)
                        editor
                          .chain()
                          .focus()
                          .setVideo({
                            provider: 'media',
                            mediaId: next.mediaId || '',
                            src: next.url,
                          })
                          .run()
                        emit(editor.getHTML())
                        setPickerMode(null)
                      }}
                    />
                  ) : (
                    <>
                      <p className="settings-hint layout-muted">
                        Paste a watch / share URL. Stored as a safe embed (no arbitrary iframes).
                      </p>
                      <label className="settings-field">
                        <span>Video URL</span>
                        <input
                          type="url"
                          value={videoUrl}
                          disabled={busy}
                          placeholder="https://www.youtube.com/watch?v=… or vimeo.com/…"
                          onChange={(e) => setVideoUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            const parsed = parseVideoInput(videoUrl)
                            if (!parsed) {
                              setVideoError('Paste a YouTube or Vimeo URL (or video id).')
                              return
                            }
                            if (!editor) return
                            setVideoError(null)
                            editor
                              .chain()
                              .focus()
                              .setVideo({
                                provider: parsed.provider,
                                videoId: parsed.videoId,
                              })
                              .run()
                            emit(editor.getHTML())
                            setPickerMode(null)
                            setVideoUrl('')
                          }}
                        />
                      </label>
                      <div className="admin-inline-actions">
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                          disabled={busy}
                          onClick={() => {
                            setPickerMode(null)
                            setVideoError(null)
                            setVideoUrl('')
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-save"
                          disabled={busy}
                          onClick={() => {
                            const parsed = parseVideoInput(videoUrl)
                            if (!parsed) {
                              setVideoError('Paste a YouTube or Vimeo URL (or video id).')
                              return
                            }
                            if (!editor) return
                            setVideoError(null)
                            editor
                              .chain()
                              .focus()
                              .setVideo({
                                provider: parsed.provider,
                                videoId: parsed.videoId,
                              })
                              .run()
                            emit(editor.getHTML())
                            setPickerMode(null)
                            setVideoUrl('')
                          }}
                        >
                          Insert embed
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : imagesEnabled && MediaPickerComponent ? (
                <MediaPickerComponent
                  label={
                    pickerMode === 'gallery'
                      ? 'Add image to gallery (from Media)'
                      : 'Insert image from Media'
                  }
                  value={{ mediaId: '', url: '', alt: '' }}
                  defaultFolder="general"
                  defaultPurpose="photo"
                  disabled={busy}
                  includeHiddenInputs={false}
                  allowUrlFallback={false}
                  hint={
                    pickerMode === 'gallery'
                      ? 'Creates a gallery or appends when a gallery is selected.'
                      : 'Picks from the shared Media library (mediaId + URL).'
                  }
                  onChange={(next) => {
                    if (!editor || !next.url) return
                    if (pickerMode === 'gallery') {
                      const image = {
                        mediaId: next.mediaId || '',
                        src: next.url,
                        alt: next.alt || '',
                      }
                      if (editor.isActive('sfGallery')) {
                        editor.chain().focus().appendGalleryImage(image).run()
                      } else {
                        editor.chain().focus().setGallery([image]).run()
                      }
                    } else {
                      editor
                        .chain()
                        .focus()
                        .insertContent({
                          type: 'sfImage',
                          attrs: {
                            src: next.url,
                            alt: next.alt || '',
                            mediaId: next.mediaId || null,
                          },
                        })
                        .run()
                      setPickerMode(null)
                    }
                    emit(editor.getHTML())
                  }}
                />
              ) : null}
            </div>
          ) : null}

          <EditorContent editor={editor} className="sf-rich-editor-surface" />
        </>
      ) : (
        <div className="sf-rich-editor-html">
          <p className="sf-rich-editor-html-hint layout-muted">
            {preset === 'email'
              ? 'Edit email-safe HTML only (no scripts, embeds, or web-only blocks). Switch back to Visual to parse.'
              : 'Edit sanitized HTML. Switch back to Visual to parse into the editor. Scripts are stripped on save.'}
          </p>
          <div className="sf-code-field-panel sf-code-field-panel-dark sf-rich-editor-cm">
            <CodeMirror
              value={htmlValue}
              height="220px"
              theme="none"
              extensions={cmExtensions}
              editable={!disabled}
              onChange={(next) => {
                setHtmlValue(next)
                onChange?.(sanitizeEditorHtml(preset, next))
              }}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightActiveLine: true,
                bracketMatching: true,
              }}
              className="sf-code-mirror"
            />
          </div>
        </div>
      )}

      {name ? (
        <input type="hidden" name={name} value={sanitizeEditorHtml(preset, htmlValue)} readOnly />
      ) : null}

      <CalloutInsertDialog
        open={calloutDialogOpen}
        onClose={() => setCalloutDialogOpen(false)}
        onInsert={(variant) => {
          if (!editor) return
          editor.chain().focus().setCallout(variant).run()
          emit(editor.getHTML())
        }}
      />

      <LinkInsertDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onInsert={(href) => {
          if (!editor) return
          editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
          emit(editor.getHTML())
        }}
      />
    </div>
  )
}
