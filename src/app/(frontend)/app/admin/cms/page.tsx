import React from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { requireAppAdmin } from '@/core/auth/admin'
import {
  BOOTSTRAP_ADMIN_EMAIL,
  DEFAULT_CMS_BRIDGE_PASSWORD,
  findPayloadCmsUserByEmail,
  getCmsBridgePassword,
} from '@/core/cms-bridge'
import { CmsBridgePanel } from './cms-bridge-panel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'CMS access — Starforge',
  description: 'Link global app admin to Payload /admin as a CMS editor.',
}

export default async function AdminCmsBridgePage() {
  const session = await requireAppAdmin()
  if (!session?.user?.email) {
    redirect('/login?next=/app/admin/cms')
  }
  const email = session.user.email.trim().toLowerCase()
  const linked = await findPayloadCmsUserByEmail(email)
  const bridgePassword = getCmsBridgePassword()
  const isBootstrap = email === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
  const usingDefaultBridge = bridgePassword === DEFAULT_CMS_BRIDGE_PASSWORD

  return (
    <section className="admin-section">
      <h2>Payload CMS access</h2>
      <p className="lede admin-lede">
        Global app admins get a <strong>linked</strong> Payload editor (same email). Product
        members stay in core only — we never move app users into Payload. Sessions stay separate:
        sign in at <Link href="/admin">/admin</Link> with the CMS password (seed bootstrap uses the
        same password as core for <code>{BOOTSTRAP_ADMIN_EMAIL}</code>).
      </p>

      <dl className="cms-bridge-meta">
        <div>
          <dt>Your app email</dt>
          <dd>
            <code>{email}</code>
          </dd>
        </div>
        <div>
          <dt>CMS editor linked?</dt>
          <dd>{linked ? <span className="admin-badge">Yes</span> : <span className="admin-badge-warn">Not yet</span>}</dd>
        </div>
        <div>
          <dt>CMS bridge password</dt>
          <dd>
            {isBootstrap ? (
              <>
                Same as core login: <code>{DEFAULT_CMS_BRIDGE_PASSWORD}</code> (after{' '}
                <code>npm run seed</code>)
              </>
            ) : (
              <>
                Env <code>STARFORGE_CMS_BRIDGE_PASSWORD</code>
                {usingDefaultBridge ? (
                  <>
                    {' '}
                    (unset → default <code>{DEFAULT_CMS_BRIDGE_PASSWORD}</code>)
                  </>
                ) : (
                  ' (custom value set in .env)'
                )}
              </>
            )}
          </dd>
        </div>
      </dl>

      <CmsBridgePanel initiallyLinked={Boolean(linked)} email={email} />

      <p className="admin-lede cms-bridge-footnote">
        After linking, open <Link href="/admin">Payload /admin</Link> → sign in with{' '}
        <code>{email}</code> and the bridge password → edit Pages / Media. Core{' '}
        <Link href="/app/admin/users">user admin</Link> and{' '}
        <Link href="/app/admin/settings">site settings</Link> stay on this app shell.
      </p>
    </section>
  )
}
