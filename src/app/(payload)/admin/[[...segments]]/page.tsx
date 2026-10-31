/* Payload admin shell — gated by Starforge Better Auth (one login). */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

import { getAppSession } from '@/core/auth/session'
import { ensurePayloadCmsUser, loadCoreUserCmsAccess } from '@/core/cms-bridge'

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

  // Ensure linked Payload stub exists before RootPage runs auth strategies.
  await ensurePayloadCmsUser({
    coreUserId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  })

  return RootPage({ config, params, searchParams, importMap })
}

export default Page
