/* Payload admin — require Better Auth + payload-token (via /api/cms/exchange). */
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

import { PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'
import { getAdminSession } from '@/core/auth/admin-session'
import { getAppSession } from '@/core/auth/session'
import { loadCoreUserCmsAccess } from '@/core/cms-bridge'
import { PAYLOAD_TOKEN_COOKIE } from '@/core/cms-bridge/payload-session'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = ({ params, searchParams }: Args): Promise<Metadata> =>
  generatePageMetadata({ config, params, searchParams })

const Page = async ({ params, searchParams }: Args) => {
  const { segments } = await params
  const first = segments?.[0]
  // Never render Payload stock login / create-first-user (middleware also blocks these).
  if (first === 'login' || first === 'create-first-user') {
    redirect(`/api/cms/exchange?next=${PAYLOAD_ADMIN_BASE}`)
  }

  let session = await getAdminSession()
  if (!session?.user?.id) {
    const publicSession = await getAppSession()
    if (publicSession?.user?.id) {
      redirect(
        `/api/auth/admin-session?next=${encodeURIComponent(`/api/cms/exchange?next=${PAYLOAD_ADMIN_BASE}`)}`,
      )
    }
    redirect(`/login?next=${PAYLOAD_ADMIN_BASE}`)
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  if (!access?.cmsAccess || access.banned) {
    redirect('/?notice=cms-denied')
  }

  const cookieStore = await cookies()
  const hasToken = Boolean(cookieStore.get(PAYLOAD_TOKEN_COOKIE)?.value)
  if (!hasToken) {
    // Route Handler can Set-Cookie; Server Components cannot (Next.js 15+/16).
    redirect(`/api/cms/exchange?next=${PAYLOAD_ADMIN_BASE}`)
  }

  return RootPage({ config, params, searchParams, importMap })
}

export default Page
