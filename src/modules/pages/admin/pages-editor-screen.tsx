import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { getLocalizationSettings } from '@/core/localization/store'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { findPageById, listPageVersions, loadPageLocaleMaps } from '../store'
import { PageEditor } from './page-editor'

type Chrome = React.ComponentProps<typeof PageEditor>['chrome']

async function editorChrome(t: Awaited<ReturnType<typeof getTranslations>>): Promise<Chrome> {
  return {
    tabContent: t('tabContent'),
    tabSeo: t('tabSeo'),
    fieldTitle: t('fieldTitle'),
    fieldSlug: t('fieldSlug'),
    slugHint: t('slugHint'),
    fieldBody: t('fieldBody'),
    bodyHint: t('bodyHint'),
    fieldTags: t('fieldTags'),
    tagsHint: t('tagsHint'),
    fieldMetaTitle: t('fieldMetaTitle'),
    metaTitleHint: t('metaTitleHint'),
    fieldMetaDescription: t('fieldMetaDescription'),
    metaDescriptionHint: t('metaDescriptionHint'),
    fieldOg: t('fieldOg'),
    ogHint: t('ogHint'),
    saveDraft: t('saveDraft'),
    publish: t('publish'),
    preview: t('preview'),
    viewPublic: t('viewPublic'),
    delete: t('delete'),
    confirmDelete: t('confirmDelete'),
    savedDraft: t('savedDraft'),
    savedPublished: t('savedPublished'),
    localeFiles: t('localeFiles'),
    versionsHeading: t('versionsHeading'),
    versionsHint: t('versionsHint'),
    versionRestore: t('versionRestore'),
    versionConfirm: t('versionConfirm'),
    versionEmpty: t('versionEmpty'),
    versionRestored: t('versionRestored'),
  }
}

export async function PagesEditorScreen({ pageId }: { pageId: string | null }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pages)) {
    redirect('/admin/settings')
  }

  const t = await getTranslations('product:pages')
  const [locales, localization] = await Promise.all([
    getContentLocaleOptions(),
    getLocalizationSettings(),
  ])
  const page = pageId ? await findPageById(pageId) : null
  if (pageId && !page) notFound()
  const maps = page ? await loadPageLocaleMaps(page.id, locales.map((locale) => locale.code)) : null
  const versions = page ? await listPageVersions(page.id) : []
  const chrome = await editorChrome(t)

  return (
    <section className="admin-section admin-layouts-full">
      <p className="admin-inline-actions">
        <Link href="/admin/pages">{t('backToList')}</Link>
      </p>
      <h2>{page ? t('editHeading') : t('newHeading')}</h2>
      <p className="lede admin-lede">{t('editLede')}</p>
      <PageEditor
        page={
          page
            ? {
                id: page.id,
                slug: page.slug,
                status: page.status,
                title: page.title,
                body: page.body,
                metaTitle: page.metaTitle,
                metaDescription: page.metaDescription,
                metaMediaId: page.metaMediaId,
                tags: page.tags.map((tag) => tag.title).join(', '),
                titleLocales: maps?.titleLocales ?? {},
                bodyLocales: maps?.bodyLocales ?? {},
                metaTitleLocales: maps?.metaTitleLocales ?? {},
                metaDescriptionLocales: maps?.metaDescriptionLocales ?? {},
              }
            : null
        }
        versions={versions.map((version) => ({
          id: version.id,
          title: version.title,
          status: version.status,
          createdAt: version.createdAt.toISOString(),
        }))}
        locales={locales}
        previewLocale={localization.defaultLocale}
        chrome={chrome}
      />
    </section>
  )
}
