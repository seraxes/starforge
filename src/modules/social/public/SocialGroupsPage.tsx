import type { Metadata } from 'next'
import Link from 'next/link'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { requireAdminArea } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'

import { groupHref } from '../groups'
import {
  ensureDefaultGroupCategories,
  listGroupCategories,
  listGroupsDirectory,
} from '../groups-store'
import { actorMayCreateSocialEntity } from '../pack-settings'
import { loadSocialModuleSettings } from '../settings'
import { CreateGroupForm } from './GroupActions'

type Args = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ category?: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  return {
    title: 'Groups',
    description: `Find groups on ${siteName}.`,
  }
}

/** Groups directory — `/feed/groups`. */
export default async function SocialGroupsPage({ params, searchParams }: Args) {
  const { locale: localeParam } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session, query] = await Promise.all([
    getSiteSettings(),
    getAppSession(),
    searchParams,
  ])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/feed/groups', locale),
  )}`
  const categoryId = query.category?.trim() || null

  await ensureDefaultGroupCategories()
  const [categories, directory, pack, staff] = await Promise.all([
    listGroupCategories(),
    listGroupsDirectory({ categoryId }),
    loadSocialModuleSettings(),
    userId ? requireAdminArea('admin.social', 'manage') : Promise.resolve(null),
  ])
  const canCreate =
    pack.settings.allowGroups &&
    actorMayCreateSocialEntity(
      pack.settings.groupWhoCanCreate,
      Boolean(staff?.user?.id),
    )

  return (
    <article className="cms-page sf-social-groups-page">
      <header className="cms-page-header">
        <h1>Groups</h1>
        <p className="lede">Browse groups and join walls for members only.</p>
      </header>

      <nav className="sf-social-groups-filters" aria-label="Group categories">
        <Link
          className={!categoryId ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'}
          href={withLocalePrefix('/feed/groups', locale)}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            className={
              categoryId === cat.id ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
            }
            href={`${withLocalePrefix('/feed/groups', locale)}?category=${encodeURIComponent(cat.id)}`}
          >
            {cat.name}
          </Link>
        ))}
      </nav>

      {userId && canCreate ? (
        <section className="sf-social-groups-create" aria-label="Create a group">
          <h2 className="sf-social-section-heading">Create a group</h2>
          <CreateGroupForm
            categories={categories}
            defaultVisibility={pack.settings.defaultGroupJoinRule}
          />
        </section>
      ) : userId ? null : (
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>{' '}
          to create or join groups.
        </p>
      )}

      <section className="sf-social-groups-directory" aria-label="Group directory">
        <h2 className="sf-social-section-heading">Directory</h2>
        {directory.length === 0 ? (
          <p className="layout-muted">No groups yet.</p>
        ) : (
          <ul className="sf-social-groups-list">
            {directory.map(({ group, category, memberCount }) => (
              <li key={group.id} className="sf-social-groups-item">
                <Link
                  href={withLocalePrefix(groupHref(group.slug), locale)}
                  className="sf-social-groups-link"
                >
                  <span className="sf-social-groups-name">{group.name}</span>
                  <span className="layout-muted">
                    {category?.name ?? 'Group'} · {memberCount} member
                    {memberCount === 1 ? '' : 's'} · {group.visibility}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}
