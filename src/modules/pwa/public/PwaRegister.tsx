import React from 'react'

import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { PwaRegisterClient } from './PwaRegisterClient'

/**
 * Public-shell contribution for product:pwa (bodyEnd).
 * Gates SW registration on Site Settings → Modules.
 */
export default async function PwaRegister() {
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.pwa)) return null
  return <PwaRegisterClient />
}
