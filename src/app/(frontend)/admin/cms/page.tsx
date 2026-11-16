import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAdminArea } from '@/core/acl/access'
import { loadCoreUserCmsAccess } from '@/core/cms-bridge'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'CMS access — Starforge',
  description: 'Better Auth cms_access opens editorial pages and draft preview.',
}

export default async function AdminCmsBridgePage() {
  const session = await requireAdminArea('admin.cms', 'view')
  if (!session?.user?.id || !session.user.email) {
    redirect('/admin/login?next=/admin/cms')
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  const email = session.user.email.trim().toLowerCase()
  const hasCms = Boolean(access?.cmsAccess) && !access?.banned

  return (
    <section className="admin-section">
      <h2>CMS access</h2>
      <p className="lede admin-lede">
        <strong>One account.</strong> Staff sign in at <Link href="/admin/login">/admin/login</Link>.
        When CMS access is on, this user can edit brochure pages and open draft preview. Toggle it
        per user under <Link href="/admin/users">Users</Link>.
      </p>

      <dl className="cms-bridge-meta">
        <div>
          <dt>Your app email</dt>
          <dd>
            <code>{email}</code>
          </dd>
        </div>
        <div>
          <dt>CMS access</dt>
          <dd>
            {hasCms ? (
              <span className="admin-badge">On</span>
            ) : (
              <span className="admin-badge-warn">Off</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="cms-bridge-panel">
        <div className="cms-bridge-actions">
          {hasCms ? (
            <>
              <Link className="primary" href="/admin/pages">
                Open pages
              </Link>
              <Link className="secondary" href="/admin/media">
                Open media
              </Link>
            </>
          ) : (
            <Link className="secondary" href="/admin/users">
              Turn on CMS access in Users
            </Link>
          )}
        </div>
      </div>

      <p className="admin-lede cms-bridge-footnote">
        Former <code>/cms</code> addresses redirect to <code>/admin</code>. Ordinary members do not
        need CMS access to use the site.
      </p>

      <h3 className="admin-subhead">Draft preview</h3>
      <p className="admin-lede">
        Turn on <strong>Draft preview</strong> under <Link href="/admin/settings">Settings</Link>,
        then open <code>/preview/&#123;slug&#125;</code> while signed in with CMS access.
        Unpublished pages render there; anonymous visitors still only see published pages.
      </p>
    </section>
  )
}
