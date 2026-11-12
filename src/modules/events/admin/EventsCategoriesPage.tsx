import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ensureDefaultUserGroupsSeeded, listUserGroupOptions } from '@/core/acl'
import { getContentLocaleOptions } from '@/core/i18n/locale-text.server'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { listEventCategories, loadEventCategoryLocaleMaps } from '../categories'
import { ensureEventRegistrationFormSeeded, listEventRegistrationFormOptions } from '../registration-form'
import { CategoriesManager } from './categories-manager'
import { EventsAdminNav } from './events-admin-nav'

export const metadata = {
  title: 'Categories — Events — Starforge',
  description: 'Event categories, ACL, and registration forms (Events module).',
}

/** product:events — editorial categories for the public hub filter. */
export default async function EventsCategoriesPage() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.events)) {
    redirect('/admin/settings')
  }

  await ensureDefaultUserGroupsSeeded()
  await ensureEventRegistrationFormSeeded()
  const [categories, forms, groups, locales] = await Promise.all([
    listEventCategories(),
    listEventRegistrationFormOptions(),
    listUserGroupOptions(),
    getContentLocaleOptions(),
  ])
  const localeCodes = locales.map((locale) => locale.code)
  const rows = await Promise.all(
    categories.map(async (category) => {
      const maps = await loadEventCategoryLocaleMaps(category.id, localeCodes)
      return {
        id: category.id,
        title: category.title,
        slug: category.slug,
        description: category.description,
        registrationFormId: category.registrationFormId,
        published: category.published,
        sortOrder: category.sortOrder,
        accessTags: category.accessTags,
        titleLocales: maps.titleLocales,
        descriptionLocales: maps.descriptionLocales,
        updatedAt: category.updatedAt.toISOString(),
      }
    }),
  )

  return (
    <section className="admin-section admin-layouts-full">
      <EventsAdminNav active="categories" />
      <h2>Categories</h2>
      <p className="lede admin-lede">
        <strong>Add +</strong> · table · Edit one category. Assign who can see it and which{' '}
        <Link href="/admin/forms">registration form</Link> events in it use. Featured stays the
        carousel flag on each event.
      </p>
      <CategoriesManager
        categories={rows}
        forms={forms}
        groups={groups}
        locales={locales}
      />
    </section>
  )
}
