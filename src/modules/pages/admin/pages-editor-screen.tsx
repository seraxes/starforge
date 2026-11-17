import React from 'react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { getLocalizationSettings } from '@/core/localization/store'
import { rootPageSlug } from '@/core/nav/root'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPageCategories } from '../categories'
import { findPageById, listPageVersions, listUserDisplayNames, loadPageLocaleMaps } from '../store'
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
    fieldCategory: t('fieldCategory'),
    categoryHint: t('categoryHint'),
    categoryNone: t('categoryNone'),
    manageCategories: t('manageCategories'),
    fieldTags: t('fieldTags'),
    tagsHint: t('tagsHint'),
    fieldMetaTitle: t('fieldMetaTitle'),
    metaTitleHint: t('metaTitleHint'),
    fieldMetaDescription: t('fieldMetaDescription'),
    metaDescriptionHint: t('metaDescriptionHint'),
    fieldOg: t('fieldOg'),
    ogHint: t('ogHint'),
    saveDraft: t('saveDraft'),
    unpublish: t('unpublish'),
    publish: t('publish'),
    preview: t('preview'),
    viewPublic: t('viewPublic'),
    delete: t('delete'),
    confirmDelete: t('confirmDelete'),
    savedDraft: t('savedDraft'),
    savedPublished: t('savedPublished'),
    savedUnpublished: t('savedUnpublished'),
    publishingHeading: t('publishingHeading'),
    fieldStatus: t('fieldStatus'),
    fieldCreated: t('fieldCreated'),
    fieldPublished: t('fieldPublished'),
    fieldCreator: t('fieldCreator'),
    fieldPublisher: t('fieldPublisher'),
    notPublished: t('notPublished'),
    metaUnknown: t('metaUnknown'),
    statusDraft: t('statusDraft'),
    statusPublished: t('statusPublished'),
    statusUnpublished: t('statusUnpublished'),
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
  const [locales, localization, categories] = await Promise.all([
    getContentLocaleOptions(),
    getLocalizationSettings(),
    listPageCategories(),
  ])
  const page = pageId ? await findPageById(pageId) : null
  if (pageId && !page) notFound()
  const maps = page ? await loadPageLocaleMaps(page.id, locales.map((locale) => locale.code)) : null
  const versions = page ? await listPageVersions(page.id) : []
  const names = page
    ? await listUserDisplayNames([page.createdByUserId, page.publishedByUserId])
    : new Map<string, string>()
  const chrome = await editorChrome(t)

  return (
    <section className="admin-section admin-layouts-full">
      <p className="admin-inline-actions">
        <Link href="/admin/pages">{t('backToList')}</Link>
      </p>
      <PageEditor
        heading={page ? t('editHeading') : t('newHeading')}
        lede={t('editLede')}
        page={
          page
            ? {
                id: page.id,
                slug: page.slug,
                status: page.status,
                createdAt: page.createdAt.toISOString(),
                publishedAt: page.publishedAt ? page.publishedAt.toISOString() : '',
                creatorName: names.get(page.createdByUserId) ?? '',
                publisherName: names.get(page.publishedByUserId) ?? '',
                title: page.title,
                body: page.body,
                metaTitle: page.metaTitle,
                metaDescription: page.metaDescription,
                metaMediaId: page.metaMediaId,
                tags: page.tags.map((tag) => tag.title).join(', '),
                categoryId: page.categoryId,
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
        categories={categories.map((category) => ({
          id: category.id,
          title: category.title,
        }))}
        locales={locales}
        previewLocale={localization.defaultLocale}
        rootPageSlug={await rootPageSlug()}
        chrome={chrome}
      />
    </section>
  )
}
