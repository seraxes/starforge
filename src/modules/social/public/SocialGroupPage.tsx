import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { getAppSession } from '@/core/auth/session'
import { requireContentLocale } from '@/core/content/pages'
import { isValidLocaleCode } from '@/core/i18n'
import { withLocalePrefix } from '@/core/i18n/path'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'
import { getSiteChrome } from '@/core/site-chrome'
import { getPersonas } from '@/modules/profiles/api.server'

import { listAlbumItems, listAlbumsForOwner } from '../albums-store'
import { canManageGroupMembers, isActiveGroupMember } from '../groups'
import {
  categorySupportsTeamTools,
  resolveGroupPermissions,
} from '../group-tools'
import {
  countActiveGroupMembers,
  findGroupBySlug,
  findGroupCategory,
  findGroupMembership,
  findGroupRank,
  listActiveGroupMembers,
  listGroupDocuments,
  listGroupRanks,
  listGroupWallPosts,
  listRequestedGroupMembers,
} from '../groups-store'
import { viewerMayModerateSocialContent } from '../staff-grant'
import { AlbumList, CreateAlbumForm } from './AlbumActions'
import { FeedPostList } from './FeedPostList'
import {
  AcceptGroupInviteButton,
  AddGroupDocumentForm,
  AnnounceGroupPostButton,
  AssignGroupRankForm,
  CreateGroupRankForm,
  DeleteGroupButton,
  GroupDocumentsList,
  GroupWallComposer,
  InviteToGroupForm,
  JoinGroupButton,
  PendingJoinRequestsList,
  RemoveGroupMemberForm,
  SetGroupFormDefinitionForm,
  SetGroupMemberRoleForm,
  TransferGroupForm,
} from './GroupActions'
import { GroupJoinIntake } from './GroupJoinIntake'
import { HostedEventsPanel } from './HostedEventsPanel'
import { SocialEntityTabs } from './SocialEntityTabs'

type Args = {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ tab?: string }>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { locale: localeParam, slug } = await params
  const [settings, chrome] = await Promise.all([getSiteSettings(), getSiteChrome()])
  const siteName = chrome.siteName || settings.siteName

  if (!isValidLocaleCode(localeParam)) {
    return { title: `Not found — ${siteName}` }
  }
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) {
    return { title: `Not found — ${siteName}` }
  }

  const group = await findGroupBySlug(slug)
  if (!group) return { title: `Not found — ${siteName}` }

  return {
    title: group.name,
    description: group.description || `Group on ${siteName}.`,
  }
}

/** Group wall — `/feed/g/[slug]`. Non-members do not see wall posts. */
export default async function SocialGroupPage({ params, searchParams }: Args) {
  const { locale: localeParam, slug } = await params
  if (!isValidLocaleCode(localeParam)) notFound()
  const locale = requireContentLocale(localeParam)
  setRequestLocale(locale)

  const [settings, session, viewer, query] = await Promise.all([
    getSiteSettings(),
    getAppSession(),
    getAccessViewer(),
    searchParams,
  ])
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.social)) notFound()

  const group = await findGroupBySlug(slug)
  if (!group) notFound()

  const userId = session?.user?.id ? String(session.user.id).trim() : ''
  const groupPath = withLocalePrefix(`/feed/g/${group.slug}`, locale)
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    groupPath,
  )}`
  const eventsEnabled = isCatalogModuleEnabled(settings, MODULE_IDS.events)
  const activeTab =
    eventsEnabled && (query.tab ?? '').trim() === 'calendar' ? 'calendar' : 'wall'

  const [membership, category, memberCount, staffCanManage, t] = await Promise.all([
    userId ? findGroupMembership(group.id, userId) : Promise.resolve(null),
    findGroupCategory(group.categoryId),
    countActiveGroupMembers(group.id),
    userId ? viewerMayModerateSocialContent(userId) : Promise.resolve(false),
    getTranslations('product:social'),
  ])
  const isMember = isActiveGroupMember(membership)
  const canInvite = canManageGroupMembers(membership)
  const teamTools = categorySupportsTeamTools(category?.kind)
  const actorRank =
    membership?.rankId && teamTools ? await findGroupRank(membership.rankId) : null
  const perms = resolveGroupPermissions(membership, actorRank)
  const canReviewJoinRequests = perms.canManageMembers || staffCanManage

  const [posts, ranks, documents, members, pendingRequests, albums] = await Promise.all([
    isMember && activeTab === 'wall' ? listGroupWallPosts(group.id) : Promise.resolve([]),
    isMember && teamTools && activeTab === 'wall'
      ? listGroupRanks(group.id)
      : Promise.resolve([]),
    isMember && teamTools && activeTab === 'wall'
      ? listGroupDocuments(group.id)
      : Promise.resolve([]),
    isMember &&
      activeTab === 'wall' &&
      (perms.isOwner || perms.isAdmin || perms.canManageMembers)
      ? listActiveGroupMembers(group.id)
      : Promise.resolve([]),
    canReviewJoinRequests && activeTab === 'wall'
      ? listRequestedGroupMembers(group.id)
      : Promise.resolve([]),
    isMember && activeTab === 'wall'
      ? listAlbumsForOwner('group', group.id)
      : Promise.resolve([]),
  ])
  const personas = await getPersonas(
    posts.map((p) => p.authorUserId),
    viewer,
  )
  const items = posts.map((post) => ({
    post,
    author: personas.get(post.authorUserId) ?? null,
  }))
  const itemsByAlbum = new Map(
    await Promise.all(
      albums.map(async (album) => [album.id, await listAlbumItems(album.id)] as const),
    ),
  )

  return (
    <article className="cms-page sf-social-group-page">
      <header className="cms-page-header">
        <p className="layout-muted">
          <Link href={withLocalePrefix('/feed/groups', locale)}>Groups</Link>
          {category ? ` · ${category.name}` : null}
          {` · ${group.visibility} · ${memberCount} member${memberCount === 1 ? '' : 's'}`}
        </p>
        <h1>{group.name}</h1>
        {group.description ? <p className="lede">{group.description}</p> : null}
      </header>

      {isMember ? (
        <SocialEntityTabs
          wallHref={groupPath}
          calendarHref={`${groupPath}?tab=calendar`}
          active={activeTab}
          showCalendar={eventsEnabled}
        />
      ) : null}

      {!userId ? (
        <p>
          <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
            Sign in
          </Link>{' '}
          to join this group.
        </p>
      ) : !isMember ? (
        <section className="sf-social-group-join" aria-label="Join group">
          {membership?.status === 'invited' ? (
            <AcceptGroupInviteButton groupId={group.id} />
          ) : membership?.status === 'requested' ? (
            <p className="layout-muted">{t('joinRequestPending')}</p>
          ) : (
            <>
              {group.visibility === 'closed' && group.formDefinitionId ? (
                <GroupJoinIntake
                  groupId={group.id}
                  formDefinitionId={group.formDefinitionId}
                />
              ) : null}
              <JoinGroupButton groupId={group.id} visibility={group.visibility} />
            </>
          )}
          <p className="layout-muted">Wall posts are visible to members only.</p>
        </section>
      ) : null}

      {canReviewJoinRequests && activeTab === 'wall' ? (
        <section
          className="sf-social-group-pending-joins"
          aria-label={t('pendingJoinRequests')}
        >
          <h2 className="sf-social-section-heading">{t('pendingJoinRequests')}</h2>
          <PendingJoinRequestsList groupId={group.id} requests={pendingRequests} />
        </section>
      ) : null}

      {isMember && activeTab === 'calendar' && eventsEnabled ? (
        <HostedEventsPanel
          locale={locale}
          hostKind="group"
          hostId={group.id}
          canManage={perms.canManageCalendar}
        />
      ) : isMember && activeTab === 'wall' ? (
        <>
          <GroupWallComposer groupId={group.id} />
          {canInvite ? (
            <section className="sf-social-group-invite" aria-label="Invite member">
              <h2 className="sf-social-section-heading">Invite</h2>
              <InviteToGroupForm groupId={group.id} />
            </section>
          ) : null}

          {teamTools ? (
            <section className="sf-social-group-tools" aria-label="Team tools">
              <h2 className="sf-social-section-heading">Team tools</h2>

              {(perms.isOwner || perms.isAdmin) ? (
                <>
                  <h3 className="sf-social-section-heading">Ranks</h3>
                  <CreateGroupRankForm groupId={group.id} />
                  <AssignGroupRankForm
                    groupId={group.id}
                    members={members}
                    ranks={ranks}
                  />
                  {perms.isOwner ? (
                    <SetGroupMemberRoleForm groupId={group.id} members={members} />
                  ) : null}
                  <SetGroupFormDefinitionForm
                    groupId={group.id}
                    formDefinitionId={group.formDefinitionId}
                  />
                </>
              ) : null}

              {perms.canManageMembers ? (
                <>
                  <h3 className="sf-social-section-heading">Members</h3>
                  <RemoveGroupMemberForm
                    groupId={group.id}
                    members={members}
                    actorUserId={userId}
                  />
                </>
              ) : null}

              {perms.canManageDocuments ? (
                <>
                  <h3 className="sf-social-section-heading">Documents</h3>
                  <AddGroupDocumentForm groupId={group.id} />
                  <GroupDocumentsList documents={documents} />
                </>
              ) : (
                documents.length > 0 ? (
                  <>
                    <h3 className="sf-social-section-heading">Documents</h3>
                    <GroupDocumentsList documents={documents} />
                  </>
                ) : null
              )}

              {perms.isOwner ? (
                <>
                  <h3 className="sf-social-section-heading">Ownership</h3>
                  <TransferGroupForm
                    groupId={group.id}
                    members={members}
                    ownerUserId={group.ownerUserId}
                  />
                  <DeleteGroupButton groupId={group.id} />
                </>
              ) : null}
            </section>
          ) : null}

          <section className="sf-social-group-albums" aria-label="Group albums">
            <h2 className="sf-social-section-heading">Albums</h2>
            <CreateAlbumForm ownerType="group" ownerId={group.id} />
            <AlbumList albums={albums} itemsByAlbum={itemsByAlbum} canManage />
          </section>

          <section className="sf-social-group-wall" aria-label="Group wall">
            <h2 className="sf-social-section-heading">Wall</h2>
            <FeedPostList items={items} locale={locale} />
            {perms.canAnnounce && items.some((row) => !row.post.isAnnouncement) ? (
              <div className="sf-social-announce-list admin-control-row">
                {items
                  .filter((row) => !row.post.isAnnouncement)
                  .map(({ post }) => (
                    <AnnounceGroupPostButton
                      key={post.id}
                      groupId={group.id}
                      postId={post.id}
                    />
                  ))}
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </article>
  )
}
