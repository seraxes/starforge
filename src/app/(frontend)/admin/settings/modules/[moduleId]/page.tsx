import React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ModuleSettingsPanelHost } from '@/core/modules'
import {
  findExistingModuleSettingsHref,
  getSiteSettings,
  isCatalogModuleEnabled,
  listInstalledModuleCatalog,
  moduleIdFromPathSegment,
  moduleInfoSettingsHref,
} from '@/core/settings'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ moduleId: string }>
}

const KIND_LABEL: Record<string, string> = {
  platform: 'Platform',
  product: 'Product',
  particle: 'Particle',
  atom: 'Atom',
}

export async function generateMetadata({ params }: PageProps) {
  const { moduleId: raw } = await params
  const id = moduleIdFromPathSegment(raw)
  const item = listInstalledModuleCatalog().find((row) => row.id === id)
  const label = item?.label ?? id
  return {
    title: `${label} — Info / Settings — Starforge`,
    description: item?.description ?? `Module info and settings for ${id}.`,
  }
}

/**
 * Core host for Modules catalog info/settings (Joomla extension-style).
 * Packs with their own Settings leaf (Media, Forms, …) are linked from the
 * Modules list directly; this page still serves packs without knobs as a soft stub.
 */
export default async function AdminModuleInfoSettingsPage({ params }: PageProps) {
  const { moduleId: raw } = await params
  const id = moduleIdFromPathSegment(raw)
  const catalog = listInstalledModuleCatalog()
  const item = catalog.find((row) => row.id === id)
  if (!item) notFound()

  const settings = await getSiteSettings()
  const enabled = item.required || isCatalogModuleEnabled(settings, item.id)
  const packSettingsHref = findExistingModuleSettingsHref(item.id, item)
  const coreHref = moduleInfoSettingsHref(item.id)
  const usesPackSettings = Boolean(packSettingsHref) && packSettingsHref !== coreHref

  return (
    <section className="admin-section">
      <h2>
        {item.label}
        <span className="settings-modules-badge settings-modules-badge-muted">
          {KIND_LABEL[item.kind] ?? item.kind}
        </span>
        {item.required ? <span className="settings-modules-badge">Required</span> : null}
      </h2>
      <p className="lede admin-lede">
        Module info and settings. Catalog on/off lives under{' '}
        <Link href="/admin/settings">Settings → Modules</Link>
        {'. '}
        {enabled ? 'Currently enabled.' : 'Currently disabled in the Modules list.'}
      </p>

      <div className="admin-settings-mosaic">
        <fieldset className="settings-fieldset">
          <legend>About</legend>
          <p className="settings-flag-desc">{item.description}</p>
          <p className="settings-hint">
            Id: <code className="settings-modules-id">{item.id}</code>
            {' · '}
            Default: {item.defaultEnabled ? 'on' : 'off'}
            {item.featureFlag ? (
              <>
                {' · '}
                Feature flag: <code>{item.featureFlag}</code>
              </>
            ) : null}
          </p>
          {item.navViews && item.navViews.length > 0 ? (
            <p className="settings-hint">
              Related:{' '}
              {item.navViews.map((view, index) => (
                <React.Fragment key={view.key}>
                  {index > 0 ? ' · ' : null}
                  <Link href={view.href}>{view.label}</Link>
                </React.Fragment>
              ))}
            </p>
          ) : null}
          {usesPackSettings && packSettingsHref ? (
            <p className="settings-hint">
              Pack settings: <Link href={packSettingsHref}>Open {item.label} settings</Link>
            </p>
          ) : null}
        </fieldset>

        <fieldset className="settings-fieldset settings-fieldset-wide">
          <legend>Settings</legend>
          {usesPackSettings && packSettingsHref ? (
            <p className="settings-hint">
              This module already has a Settings menu — use{' '}
              <Link href={packSettingsHref}>{packSettingsHref}</Link> for knobs. The generic
              panel host below stays available for future <code>settings.panel</code>{' '}
              contributions.
            </p>
          ) : (
            <p className="settings-hint">
              Soft stub when the pack has no knobs yet. Packs can contribute a panel via{' '}
              <code>settings.panelImportPath</code> on the module manifest (
              <code>sf_module_settings</code>).
            </p>
          )}
          <ModuleSettingsPanelHost moduleId={item.id} />
        </fieldset>
      </div>

      <p className="admin-lede">
        <Link href="/admin/settings">← Settings → Modules</Link>
      </p>
    </section>
  )
}
