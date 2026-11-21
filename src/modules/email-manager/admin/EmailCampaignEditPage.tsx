import { redirect } from 'next/navigation'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

export const metadata = {
  title: 'Email campaigns — Starforge',
  description: 'Draft and send paced emails with a template and pasted recipients.',
}

type Params = Promise<{ campaignId: string }>

/**
 * Legacy deep link — campaigns edit expands on the list page now.
 * Keep the route so old bookmarks still land on Campaigns.
 */
export default async function EmailCampaignEditPage({ params }: { params: Params }) {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.emailManager)) {
    redirect('/admin/settings')
  }

  const { campaignId } = await params
  const id = (campaignId || '').trim()
  // List expand is client state; land on the list (id ignored after peel).
  void id
  redirect('/admin/email/campaigns')
}
