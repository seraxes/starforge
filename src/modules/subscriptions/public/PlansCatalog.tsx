import React from 'react'
import Link from 'next/link'

import { withLocalePrefix } from '@/core/i18n'

import { SubscribePlanForm } from './SubscribePlanForm'
import { SubscriptionIntakeForm } from './SubscriptionIntakeForm'
import { formatBillingPeriodLabel, type SubscriptionPlanRecord } from '../types'
import { planTypeSummary } from '../catalog'

export type PlansCatalogProps = {
  plans: SubscriptionPlanRecord[]
  locale: string
  signedIn: boolean
  currency: string
  methods: string[]
  formatMoney: (major: number) => string
  heading?: string
  emptyMessage?: string
  showDescription?: boolean
  /** Extra class on the outer section (particle vs full page). */
  className?: string
  showAccountLink?: boolean
}

/**
 * Public plan mosaic — place on `/plans` or via the subscription-plans particle.
 * Guests get a sign-in CTA; signed-in users get the same subscribe form as account.
 */
export function PlansCatalog({
  plans,
  locale,
  signedIn,
  methods,
  formatMoney,
  heading = '',
  emptyMessage = 'No plans are for sale yet.',
  showDescription = true,
  className = '',
  showAccountLink = true,
}: PlansCatalogProps) {
  const loginHref = `${withLocalePrefix('/login', locale)}?next=${encodeURIComponent(
    withLocalePrefix('/plans', locale),
  )}`
  const accountHref = withLocalePrefix('/account/subscriptions', locale)

  return (
    <section
      className={`sf-subscription-plans${className ? ` ${className}` : ''}`}
      aria-label={heading.trim() || 'Plans'}
    >
      {heading.trim() ? (
        <h2 className="sf-subscription-plans-heading">{heading.trim()}</h2>
      ) : null}
      {showAccountLink && signedIn ? (
        <p className="sf-subscription-plans-account">
          <Link href={accountHref}>Manage my subscriptions</Link>
        </p>
      ) : null}
      {plans.length === 0 ? (
        <p className="sf-subscription-plans-empty">{emptyMessage}</p>
      ) : (
        <div className="sf-subscription-plans-grid">
          {plans.map((plan) => {
            const periodLabel = formatBillingPeriodLabel(
              plan.billingPeriod,
              plan.billingIntervalCount,
            )
            const priceLabel =
              plan.price <= 0
                ? `Free / ${periodLabel}`
                : `${formatMoney(plan.price)} / ${periodLabel}`
            return (
              <article key={plan.id} className="sf-subscription-plan-card" id={`plan-${plan.id}`}>
                <header className="sf-subscription-plan-card-head">
                  <h3>{plan.title}</h3>
                  <p className="sf-subscription-plan-card-meta">
                    {planTypeSummary(plan.subject, plan.audience)}
                  </p>
                  <p className="sf-subscription-plan-card-price">{priceLabel}</p>
                </header>
                {showDescription && plan.description.trim() ? (
                  <p className="sf-subscription-plan-card-desc">{plan.description}</p>
                ) : null}
                <div className="sf-subscription-plan-card-body">
                  {signedIn ? (
                    <>
                      {plan.formDefinitionId ? (
                        <SubscriptionIntakeForm
                          planId={plan.id}
                          formDefinitionId={plan.formDefinitionId}
                        />
                      ) : null}
                      <SubscribePlanForm
                        planId={plan.id}
                        planTitle={plan.title}
                        priceLabel={priceLabel}
                        methods={methods}
                        recurringSupported={plan.recurringSupported}
                        isFree={plan.price <= 0}
                      />
                    </>
                  ) : (
                    <p className="sf-subscription-plan-card-cta">
                      <Link className="gantry-btn gantry-btn-primary" href={loginHref}>
                        Sign in to subscribe
                      </Link>
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
