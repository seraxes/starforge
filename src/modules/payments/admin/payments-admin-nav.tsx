'use client'

import React from 'react'
import Link from 'next/link'

export type PaymentsAdminTab =
  | 'overview'
  | 'orders'
  | 'invoices'
  | 'settings'
  | 'merchant'

const TABS: { id: PaymentsAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/admin/payments',
    title: 'Payments overview',
  },
  {
    id: 'orders',
    label: 'Orders',
    href: '/admin/payments/orders',
    title: 'Orders list',
  },
  {
    id: 'invoices',
    label: 'Invoices',
    href: '/admin/payments/invoices',
    title: 'Invoice list',
  },
  {
    id: 'merchant',
    label: 'My merchant',
    href: '/admin/payments/merchant',
    title: 'Premium merchant profile and keys',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/payments/settings',
    title: 'Site payments settings',
  },
]

/** Horizontal Payments admin chrome — same shell as Events. */
export function PaymentsAdminNav({ active }: { active: PaymentsAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-payments-admin-nav" aria-label="Payments">
      <ul className="gantry-layouts-nav-tabs" role="tablist">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                title={tab.title}
                className={
                  isActive ? 'gantry-layouts-nav-tab is-active' : 'gantry-layouts-nav-tab'
                }
              >
                <span className="gantry-layouts-nav-tab-label">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
