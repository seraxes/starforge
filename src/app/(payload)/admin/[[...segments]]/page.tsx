/* Payload admin — require Better Auth + payload-token (via /api/cms/exchange). */
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

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
  const session = await getAppSession()
  if (!session?.user?.id) {
    redirect('/login?next=/admin')
  }

  const access = await loadCoreUserCmsAccess(session.user.id)
  if (!access?.cmsAccess || access.banned) {
    redirect('/?notice=cms-denied')
  }

  const cookieStore = await cookies()
  const hasToken = Boolean(cookieStore.get(PAYLOAD_TOKEN_COOKIE)?.value)
  if (!hasToken) {
    // Route Handler can Set-Cookie; Server Components cannot (Next.js 15+/16).
    redirect('/api/cms/exchange?next=/admin')
  }

  return RootPage({ config, params, searchParams, importMap })
}

export default Page
