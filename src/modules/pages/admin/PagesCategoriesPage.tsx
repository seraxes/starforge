import React from 'react'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listPageCategories } from '../categories'
import { PagesAdminNav } from './pages-admin-nav'
import { PagesCategoriesManager } from './categories-manager'

export const metadata = {
  title: 'Categories — Pages — Starforge',
  description: 'Page categories (Pages module).',
}

/** product:pages — editorial categories for brochure pages. */
export default async function PagesCategoriesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pages)) {
    redirect('/admin/settings')
  }

  const t = await getTranslations('product:pages')
  let error = ''
  let categories: Awaited<ReturnType<typeof listPageCategories>> = []
  try {
    categories = await listPageCategories()
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not load categories.'
  }

  return (
    <section className="admin-section admin-layouts-full">
      <PagesAdminNav
        active="categories"
        chrome={{
          pages: t('navPages'),
          categories: t('navCategories'),
          pagesTitle: t('navPagesTitle'),
          categoriesTitle: t('navCategoriesTitle'),
        }}
      />
      <h2>{t('categoriesHeading')}</h2>
      <p className="lede admin-lede">{t('categoriesLede')}</p>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : (
        <PagesCategoriesManager
          categories={categories.map((row) => ({
            id: row.id,
            title: row.title,
            slug: row.slug,
            description: row.description,
            sortOrder: row.sortOrder,
            pageCount: row.pageCount,
            updatedAt: row.updatedAt.toISOString(),
          }))}
          chrome={{
            add: t('categoryAdd'),
            close: t('categoryClose'),
            cancel: t('categoryCancel'),
            save: t('categorySave'),
            saving: t('categorySaving'),
            adding: t('categoryAdding'),
            edit: t('categoryEdit'),
            delete: t('categoryDelete'),
            deleting: t('categoryDeleting'),
            confirmDelete: t('categoryConfirmDelete'),
            emptyHeading: t('categoryEmptyHeading'),
            emptyLede: t('categoryEmptyLede'),
            listHeading: t('categoryListHeading'),
            colTitle: t('categoryColTitle'),
            colSlug: t('categoryColSlug'),
            colSort: t('categoryColSort'),
            colPages: t('categoryColPages'),
            colActions: t('categoryColActions'),
            fieldTitle: t('categoryFieldTitle'),
            fieldSlug: t('categoryFieldSlug'),
            slugHint: t('categorySlugHint'),
            fieldDescription: t('categoryFieldDescription'),
            fieldSort: t('categoryFieldSort'),
            addHint: t('categoryAddHint'),
            editHeading: t('categoryEditHeading'),
          }}
        />
      )}
    </section>
  )
}
