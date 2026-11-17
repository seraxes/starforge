'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'
import { barePathForSlug, type RootPageSlug } from '@/core/nav/root-target'
import {
  LocaleFieldLabel,
  LocaleInput,
  LocaleLanguageControl,
} from '@/core/localization/LocaleInput'
import { MediaPicker } from '@/modules/media/api'
import { RichEditor } from '@/modules/rich-editor/api'

import {
  deletePageAction,
  restorePageVersionAction,
  savePageAction,
  type PagesAdminActionState,
} from '../actions'
import type { PageStatus } from '../types'

type PageShape = {
  id: string
  slug: string
  status: PageStatus
  createdAt: string
  publishedAt: string
  creatorName: string
  publisherName: string
  title: string
  body: string
  metaTitle: string
  metaDescription: string
  metaMediaId: string
  tags: string
  categoryId: string
  titleLocales: Record<string, string>
  bodyLocales: Record<string, string>
  metaTitleLocales: Record<string, string>
  metaDescriptionLocales: Record<string, string>
}

type CategoryOption = { id: string; title: string }

type Chrome = {
  tabContent: string
  tabSeo: string
  fieldTitle: string
  fieldSlug: string
  slugHint: string
  fieldBody: string
  bodyHint: string
  fieldCategory: string
  categoryHint: string
  categoryNone: string
  manageCategories: string
  fieldTags: string
  tagsHint: string
  fieldMetaTitle: string
  metaTitleHint: string
  fieldMetaDescription: string
  metaDescriptionHint: string
  fieldOg: string
  ogHint: string
  saveDraft: string
  unpublish: string
  publish: string
  preview: string
  viewPublic: string
  delete: string
  confirmDelete: string
  savedDraft: string
  savedPublished: string
  savedUnpublished: string
  publishingHeading: string
  fieldStatus: string
  fieldCreated: string
  fieldPublished: string
  fieldCreator: string
  fieldPublisher: string
  notPublished: string
  metaUnknown: string
  statusDraft: string
  statusPublished: string
  statusUnpublished: string
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
  previewHref,
  viewPublicHref,
  showUnpublish,
  leading,
}: {
  formId: string
  pending: boolean
  chrome: Chrome
  previewHref?: string
  viewPublicHref?: string
  showUnpublish?: boolean
  leading?: React.ReactNode
}) {
  return (
    <div className="page-settings-actions sf-page-editor-actions">
      {leading}
      {previewHref ? (
        <Link className="gantry-toolbar-btn" href={previewHref}>
          {chrome.preview}
        </Link>
      ) : null}
      {viewPublicHref ? (
        <Link className="gantry-toolbar-btn" href={viewPublicHref}>
          {chrome.viewPublic}
        </Link>
      ) : null}
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
      {showUnpublish ? (
        <button
          className="gantry-toolbar-btn"
          type="submit"
          form={formId}
          name="intent"
          value="unpublish"
          disabled={pending}
        >
          {chrome.unpublish}
        </button>
      ) : null}
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
  status: PageStatus
  createdAt: string
}

function statusLabel(status: PageStatus, chrome: Chrome): string {
  if (status === 'published') return chrome.statusPublished
  if (status === 'unpublished') return chrome.statusUnpublished
  return chrome.statusDraft
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
    <section className="page-settings-panel">
      <form
        action={action}
        className="page-settings-panel-body sf-page-version-card"
        onSubmit={(event) => {
          if (!window.confirm(chrome.versionConfirm)) event.preventDefault()
        }}
      >
        <input type="hidden" name="pageId" value={pageId} />
        <input type="hidden" name="versionId" value={version.id} />
        <span suppressHydrationWarning>
          {when} — {version.title || version.id} ({statusLabel(version.status, chrome)})
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
    </section>
  )
}

function PublishingMeta({ page, chrome }: { page: PageShape; chrome: Chrome }) {
  return (
    <div className="sf-page-editor-publishing">
      <h3>{chrome.publishingHeading}</h3>
      <label className="settings-field">
        <span>{chrome.fieldStatus}</span>
        <input readOnly value={statusLabel(page.status, chrome)} />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldCreated}</span>
        <input readOnly suppressHydrationWarning value={formatWhen(page.createdAt)} />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldCreator}</span>
        <input readOnly value={page.creatorName || chrome.metaUnknown} />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldPublished}</span>
        <input
          readOnly
          suppressHydrationWarning
          value={page.publishedAt ? formatWhen(page.publishedAt) : chrome.notPublished}
        />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldPublisher}</span>
        <input readOnly value={page.publisherName || chrome.metaUnknown} />
      </label>
    </div>
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
  categories,
  locales,
  previewLocale,
  heading,
  lede,
  chrome,
  rootPageSlug,
}: {
  page: PageShape | null
  versions: VersionRow[]
  categories: CategoryOption[]
  locales: ContentLocaleOption[]
  previewLocale: string
  heading: string
  lede: string
  chrome: Chrome
  /** `undefined` = slug `home` is still `/`. `null` = a module owns `/`. */
  rootPageSlug?: RootPageSlug
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
    successMessage:
      state.message === 'Published.'
        ? chrome.savedPublished
        : state.message === 'Unpublished.'
          ? chrome.savedUnpublished
          : chrome.savedDraft,
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
  const publicBare = slug ? barePathForSlug(slug, rootPageSlug) : ''
  const publicHref = publicBare
    ? publicBare === '/'
      ? `/${previewLocale}`
      : `/${previewLocale}${publicBare}`
    : ''
  const previewHref = `/${previewLocale}/preview/${slug || 'home'}`
  const bodyValue = bodyLocale === defaultCode ? body : (bodyLocales[bodyLocale] ?? '')

  return (
    <>
      <header className="sf-page-editor-head">
        <h2>{heading}</h2>
        <Actions
          formId={formId}
          pending={pending}
          chrome={chrome}
          previewHref={page ? previewHref : undefined}
          viewPublicHref={page && page.status === 'published' ? publicHref : undefined}
          showUnpublish={Boolean(page) && page?.status !== 'unpublished'}
        />
      </header>
      <p className="lede admin-lede">{lede}</p>
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

      <div className="sf-page-editor-cards">
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
              <LocaleFieldLabel
                label={chrome.fieldBody}
                control={
                  locales.length > 1 ? (
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
                  ) : null
                }
              />
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
              <span>{chrome.fieldCategory}</span>
              <select name="categoryId" defaultValue={page?.categoryId ?? ''} disabled={pending}>
                <option value="">{chrome.categoryNone}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
              <span className="settings-hint">
                {chrome.categoryHint}{' '}
                <Link href="/admin/pages/categories">{chrome.manageCategories}</Link>.
              </span>
            </label>
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
            {page ? <PublishingMeta page={page} chrome={chrome} /> : null}
          </div>
        </section>
      </form>

      {page ? (
        <div className="sf-page-editor-versions-block">
          <div className="admin-settings-mosaic-section">
            <h3>{chrome.versionsHeading}</h3>
            <p className="settings-hint">{chrome.versionsHint}</p>
          </div>
          {versions.length === 0 ? (
            <p className="settings-hint">{chrome.versionEmpty}</p>
          ) : (
            <div className="admin-settings-mosaic sf-page-editor-versions">
              {versions.map((version) => (
                <VersionRestore
                  key={version.id}
                  pageId={page.id}
                  version={version}
                  chrome={chrome}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
      </div>

      {page ? (
        <form
          id="sf-page-delete"
          action={deleteAction}
          hidden
          onSubmit={(event) => {
            if (!window.confirm(chrome.confirmDelete)) event.preventDefault()
          }}
        >
          <input type="hidden" name="id" value={page.id} />
        </form>
      ) : null}
      {deleteState.error ? (
        <p className="admin-inline-error" role="alert">
          {deleteState.error}
        </p>
      ) : null}
      <Actions
        formId={formId}
        pending={pending}
        chrome={chrome}
        showUnpublish={Boolean(page) && page?.status !== 'unpublished'}
        leading={
          page ? (
            <button
              className="gantry-toolbar-btn gantry-toolbar-btn-danger"
              type="submit"
              form="sf-page-delete"
              disabled={deletePending}
            >
              {chrome.delete}
            </button>
          ) : null
        }
      />
    </>
  )
}
