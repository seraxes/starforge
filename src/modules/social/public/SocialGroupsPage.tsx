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

import { groupCoverMediaSrc, groupHref } from '../groups'
import {
  ensureDefaultGroupCategories,
  listGroupCategories,
  listGroupsDirectory,
} from '../groups-store'
import { actorMayCreateSocialEntity } from '../pack-settings'
import { loadSocialModuleSettings } from '../settings'
import { FeedTabs } from './FeedTabs'
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
  const tabFlags = {
    showFollowing: pack.settings.allowFollowingTab,
    showDiscover: pack.settings.allowDiscover,
    showWatch: pack.settings.allowShortVideoLayout,
    showStories: pack.settings.allowStories,
  }
  const groupsHref = withLocalePrefix('/feed/groups', locale)

  return (
    <div className="sf-social-feed-page sf-social-groups-page">
      <FeedTabs locale={locale} active="groups" {...tabFlags} />
      <div className="sf-social-directory-shell">
        <nav className="sf-social-groups-filters" aria-label="Group categories">
          <Link
            className={
              !categoryId
                ? 'sf-social-groups-filter-link is-active'
                : 'sf-social-groups-filter-link'
            }
            href={groupsHref}
            aria-current={!categoryId ? 'page' : undefined}
          >
            All
          </Link>
          {categories.map((cat) => {
            const active = categoryId === cat.id
            return (
              <Link
                key={cat.id}
                className={
                  active
                    ? 'sf-social-groups-filter-link is-active'
                    : 'sf-social-groups-filter-link'
                }
                href={`${groupsHref}?category=${encodeURIComponent(cat.id)}`}
                aria-current={active ? 'page' : undefined}
              >
                {cat.name}
              </Link>
            )
          })}
        </nav>

        <div className="sf-social-directory-toolbar">
          {userId && canCreate ? (
            <CreateGroupForm
              categories={categories}
              defaultVisibility={pack.settings.defaultGroupJoinRule}
            />
          ) : userId ? null : (
            <p className="sf-social-directory-signin">
              <Link className="sf-social-cta" href={loginHref}>
                Sign in
              </Link>
              <span className="layout-muted"> to create or join groups.</span>
            </p>
          )}
        </div>

        <section className="sf-social-directory" aria-label="Group directory">
          {directory.length === 0 ? (
            <p className="layout-muted">No groups yet.</p>
          ) : (
            <ul className="sf-social-directory-grid">
              {directory.map(({ group, memberCount }) => {
                const coverSrc = groupCoverMediaSrc(group.coverMediaId)
                return (
                  <li key={group.id} className="sf-social-directory-card">
                    <Link
                      href={withLocalePrefix(groupHref(group.slug), locale)}
                      className="sf-social-directory-card-link"
                    >
                      {coverSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverSrc}
                          alt=""
                          className="sf-social-directory-card-cover"
                        />
                      ) : (
                        <span
                          className="sf-social-directory-card-cover sf-social-directory-card-cover-empty"
                          aria-hidden
                        />
                      )}
                      <span className="sf-social-directory-card-body">
                        <span className="sf-social-directory-card-title">{group.name}</span>
                        <span className="sf-social-directory-card-meta">
                          {memberCount} member{memberCount === 1 ? '' : 's'}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
