'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'
import { LocaleInput, LocaleLanguageControl } from '@/core/localization/LocaleInput'
import { MediaPicker } from '@/modules/media/api'
import { RichEditor } from '@/modules/rich-editor/api'

import {
  deletePageAction,
  restorePageVersionAction,
  savePageAction,
  type PagesAdminActionState,
} from '../actions'

type PageShape = {
  id: string
  slug: string
  status: 'draft' | 'published'
  title: string
  body: string
  metaTitle: string
  metaDescription: string
  metaMediaId: string
  tags: string
  titleLocales: Record<string, string>
  bodyLocales: Record<string, string>
  metaTitleLocales: Record<string, string>
  metaDescriptionLocales: Record<string, string>
}

type Chrome = {
  tabContent: string
  tabSeo: string
  fieldTitle: string
  fieldSlug: string
  slugHint: string
  fieldBody: string
  bodyHint: string
  fieldTags: string
  tagsHint: string
  fieldMetaTitle: string
  metaTitleHint: string
  fieldMetaDescription: string
  metaDescriptionHint: string
  fieldOg: string
  ogHint: string
  saveDraft: string
  publish: string
  preview: string
  viewPublic: string
  delete: string
  confirmDelete: string
  savedDraft: string
  savedPublished: string
  localeFiles: string
  versionsHeading: string
  versionsHint: string
  versionRestore: string
  versionConfirm: string
  versionEmpty: string
  versionRestored: string
}

const initial: PagesAdminActionState = {}

function Actions({
  formId,
  pending,
  chrome,
}: {
  formId: string
  pending: boolean
  chrome: Chrome
}) {
  return (
    <div className="page-settings-actions">
      <button
        className="gantry-toolbar-btn"
        type="submit"
        form={formId}
        name="intent"
        value="draft"
        disabled={pending}
      >
        {chrome.saveDraft}
      </button>
      <button
        className="gantry-toolbar-btn gantry-toolbar-btn-save"
        type="submit"
        form={formId}
        name="intent"
        value="publish"
        disabled={pending}
      >
        {chrome.publish}
      </button>
    </div>
  )
}

type VersionRow = {
  id: string
  title: string
  status: 'draft' | 'published'
  createdAt: string
}

function VersionRestore({
  pageId,
  version,
  chrome,
}: {
  pageId: string
  version: VersionRow
  chrome: Chrome
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(restorePageVersionAction, initial)
  useNotifySavedOnOk(state, { successMessage: chrome.versionRestored })
  React.useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])
  const when = formatWhen(version.createdAt)
  return (
    <form
      action={action}
      className="admin-inline-actions"
      onSubmit={(event) => {
        if (!window.confirm(chrome.versionConfirm)) event.preventDefault()
      }}
    >
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="versionId" value={version.id} />
      <span>
        {when} — {version.title || version.id} (
        {version.status})
      </span>
      <button className="gantry-toolbar-btn" type="submit" disabled={pending}>
        {chrome.versionRestore}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString()
}

export function PageEditor({
  page,
  versions,
  locales,
  previewLocale,
  chrome,
}: {
  page: PageShape | null
  versions: VersionRow[]
  locales: ContentLocaleOption[]
  previewLocale: string
  chrome: Chrome
}) {
  const router = useRouter()
  const defaultCode = locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? ''
  const [title, setTitle] = useState(page?.title ?? '')
  const [titleLocales, setTitleLocales] = useState(page?.titleLocales ?? {})
  const [body, setBody] = useState(page?.body ?? '')
  const [bodyLocales, setBodyLocales] = useState(page?.bodyLocales ?? {})
  const [bodyLocale, setBodyLocale] = useState(defaultCode)
  const [metaTitle, setMetaTitle] = useState(page?.metaTitle ?? '')
  const [metaTitleLocales, setMetaTitleLocales] = useState(page?.metaTitleLocales ?? {})
  const [metaDescription, setMetaDescription] = useState(page?.metaDescription ?? '')
  const [metaDescriptionLocales, setMetaDescriptionLocales] = useState(
    page?.metaDescriptionLocales ?? {},
  )
  const [metaMediaId, setMetaMediaId] = useState(page?.metaMediaId ?? '')
  const [tab, setTab] = useState<'content' | 'seo'>('content')
  const [state, action, pending] = useActionState(savePageAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deletePageAction, initial)

  useNotifySavedOnOk(state, {
    successMessage: state.message === 'Published.' ? chrome.savedPublished : chrome.savedDraft,
  })
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (state.ok && state.id && !page) {
      router.replace(`/admin/pages/${state.id}`)
    }
  }, [state.ok, state.id, page, router])

  useEffect(() => {
    if (deleteState.deleted) router.push('/admin/pages')
  }, [deleteState.deleted, router])

  const formId = 'sf-page-editor'
  const slug = page?.slug ?? ''
  const publicHref = slug === 'home' ? `/${previewLocale}` : `/${previewLocale}/${slug}`
  const previewHref = `/${previewLocale}/preview/${slug || 'home'}`
  const bodyValue = bodyLocale === defaultCode ? body : (bodyLocales[bodyLocale] ?? '')

  return (
    <>
      <Actions formId={formId} pending={pending} chrome={chrome} />
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="admin-inline-ok" role="status">
          {state.message}
        </p>
      ) : null}

      <nav className="gantry-layouts-nav" aria-label="Page">
        <ul className="gantry-layouts-nav-tabs" role="tablist">
          {(
            [
              ['content', chrome.tabContent],
              ['seo', chrome.tabSeo],
            ] as const
          ).map(([id, label]) => (
            <li key={id}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={
                  tab === id ? 'gantry-layouts-nav-tab is-active' : 'gantry-layouts-nav-tab'
                }
                onClick={() => setTab(id)}
              >
                <span className="gantry-layouts-nav-tab-label">{label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <form id={formId} action={action} className="admin-settings-mosaic">
        <input type="hidden" name="id" value={page?.id ?? ''} />
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="titleLocales" value={JSON.stringify(titleLocales)} />
        <input type="hidden" name="body" value={body} />
        <input type="hidden" name="bodyLocales" value={JSON.stringify(bodyLocales)} />
        <input type="hidden" name="metaTitle" value={metaTitle} />
        <input type="hidden" name="metaTitleLocales" value={JSON.stringify(metaTitleLocales)} />
        <input type="hidden" name="metaDescription" value={metaDescription} />
        <input
          type="hidden"
          name="metaDescriptionLocales"
          value={JSON.stringify(metaDescriptionLocales)}
        />
        <input type="hidden" name="metaMediaId" value={metaMediaId} />

        <section
          className="page-settings-panel"
          hidden={tab !== 'content'}
        >
          <div className="page-settings-panel-body">
            <LocaleInput
              locales={locales}
              label={chrome.fieldTitle}
              requiredDefault
              values={{
                ...titleLocales,
                ...(defaultCode ? { [defaultCode]: title } : {}),
              }}
              onChange={(code, value) => {
                setTitleLocales((prev) => ({ ...prev, [code]: value }))
                if (code === defaultCode) setTitle(value)
              }}
            />
            <label className="settings-field">
              <span>{chrome.fieldSlug}</span>
              <input
                type="text"
                name="slug"
                defaultValue={slug}
                maxLength={120}
                autoComplete="off"
                placeholder="about"
                disabled={pending}
              />
              <span className="settings-hint">{chrome.slugHint}</span>
            </label>
            <div className="settings-field">
              <span>{chrome.fieldBody}</span>
              {locales.length > 1 ? (
                <LocaleLanguageControl
                  locales={locales}
                  active={bodyLocale || defaultCode}
                  label={chrome.fieldBody}
                  onActiveChange={setBodyLocale}
                  onCopyFrom={(fromCode) => {
                    const source =
                      fromCode === defaultCode ? body : (bodyLocales[fromCode] ?? '')
                    if ((bodyLocale || defaultCode) === defaultCode) setBody(source)
                    else setBodyLocales((prev) => ({ ...prev, [bodyLocale]: source }))
                  }}
                />
              ) : null}
              <RichEditor
                value={bodyValue}
                onChange={(html) => {
                  if ((bodyLocale || defaultCode) === defaultCode) setBody(html)
                  else setBodyLocales((prev) => ({ ...prev, [bodyLocale]: html }))
                }}
                preset="full"
                disabled={pending}
                MediaPicker={MediaPicker}
              />
              <span className="settings-hint">
                {chrome.bodyHint}{' '}
                <Link href="/admin/localization">{chrome.localeFiles}</Link>.
              </span>
            </div>
            <label className="settings-field">
              <span>{chrome.fieldTags}</span>
              <input
                type="text"
                name="tags"
                defaultValue={page?.tags ?? ''}
                disabled={pending}
                autoComplete="off"
              />
              <span className="settings-hint">{chrome.tagsHint}</span>
            </label>
          </div>
        </section>

        <section className="page-settings-panel" hidden={tab !== 'seo'}>
          <div className="page-settings-panel-body">
            <LocaleInput
              locales={locales}
              label={chrome.fieldMetaTitle}
              values={{
                ...metaTitleLocales,
                ...(defaultCode ? { [defaultCode]: metaTitle } : {}),
              }}
              onChange={(code, value) => {
                setMetaTitleLocales((prev) => ({ ...prev, [code]: value }))
                if (code === defaultCode) setMetaTitle(value)
              }}
            />
            <p className="settings-hint">{chrome.metaTitleHint}</p>
            <LocaleInput
              locales={locales}
              label={chrome.fieldMetaDescription}
              multiline
              rows={4}
              values={{
                ...metaDescriptionLocales,
                ...(defaultCode ? { [defaultCode]: metaDescription } : {}),
              }}
              onChange={(code, value) => {
                setMetaDescriptionLocales((prev) => ({ ...prev, [code]: value }))
                if (code === defaultCode) setMetaDescription(value)
              }}
            />
            <p className="settings-hint">{chrome.metaDescriptionHint}</p>
            <MediaPicker
              label={chrome.fieldOg}
              value={{ mediaId: metaMediaId }}
              onChange={(next) => setMetaMediaId(next.mediaId)}
              includeHiddenInputs={false}
              hint={chrome.ogHint}
            />
          </div>
        </section>
      </form>

      <Actions formId={formId} pending={pending} chrome={chrome} />

      {page ? (
        <div className="admin-inline-actions">
          <Link href={previewHref}>{chrome.preview}</Link>
          {page.status === 'published' ? <Link href={publicHref}>{chrome.viewPublic}</Link> : null}
        </div>
      ) : null}

      {page ? (
        <section className="page-settings-panel">
          <div className="page-settings-panel-head">
            <h3>{chrome.versionsHeading}</h3>
          </div>
          <div className="page-settings-panel-body">
            <p className="settings-hint">{chrome.versionsHint}</p>
            {versions.length === 0 ? (
              <p className="settings-hint">{chrome.versionEmpty}</p>
            ) : (
              versions.map((version) => (
                <VersionRestore
                  key={version.id}
                  pageId={page.id}
                  version={version}
                  chrome={chrome}
                />
              ))
            )}
          </div>
        </section>
      ) : null}

      {page ? (
        <form
          action={deleteAction}
          className="page-settings-actions"
          onSubmit={(event) => {
            if (!window.confirm(chrome.confirmDelete)) event.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={page.id} />
          {deleteState.error ? (
            <p className="admin-inline-error" role="alert">
              {deleteState.error}
            </p>
          ) : null}
          <button className="gantry-toolbar-btn" type="submit" disabled={deletePending}>
            {chrome.delete}
          </button>
        </form>
      ) : null}
    </>
  )
}
