import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import React from 'react'

import { loadHostPage } from '@/generated/module-registry.server'

export const metadata: Metadata = {
  title: 'My events',
  robots: { index: false, follow: false },
}

type Args = { params: Promise<{ locale: string }> }

/**
 * Host shell for My events. The body lives in product:events and is loaded
 * only when that pack is on the allowlist. The page composes the profiles
 * account nav inside the events module, through the profiles public door.
 */
export default async function AccountEventsPage({ params }: Args) {
  const Page = await loadHostPage('account-events')
  if (!Page) notFound()
  return <Page params={params} />
}
