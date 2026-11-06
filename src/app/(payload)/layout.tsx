/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. MODIFY AT YOUR OWN RISK. */
import config from '@payload-config'
import '@payloadcms/next/css'
import type { ServerFunctionClient } from 'payload'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import React from 'react'

import { importMap } from './cms/admin/importMap.js'
/* Starforge theme sheet via JS import — CSS @import from custom.css is unreliable
 * under Next/Turbopack (same failure that left Core admin unstyled). Keep custom.css
 * as the Payload-conventional hook; live chrome rules load here. */
import '@/core/admin-theme/themes/starforge-gantry/payload-chrome.css'
/* Same Callout / Link portal chrome as Core admin (RichEditor portals). */
import '@/core/rich-editor/rich-editor-chrome.css'
import './custom.css'

type Args = {
  children: React.ReactNode
}

const serverFunction: ServerFunctionClient = async function (args) {
  'use server'
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  })
}

const Layout = ({ children }: Args) => (
  <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
