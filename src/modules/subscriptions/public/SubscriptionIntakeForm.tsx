import React from 'react'

import { getAppSession } from '@/core/auth/session'
import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { resolveFormCaptcha } from '@/core/security/captcha'
import { formHasCaptchaField } from '@/modules/forms/api'
import { FormWidget } from '@/modules/form/FormWidget'
import { getOwnProfileContact } from '@/modules/profiles/api.server'

import { loadSubscriptionRegistrationFields } from '../registration-form'

type Props = {
  planId: string
  formDefinitionId: string
}

/**
 * Optional Forms intake before checkout — schema owned by product:forms.
 */
export async function SubscriptionIntakeForm({ planId, formDefinitionId }: Props) {
  const definitionId = formDefinitionId.trim()
  if (!definitionId) return null

  const session = await getAppSession()
  const userId = session?.user?.id?.trim() || ''
  let prefill: { name?: string; email?: string } | undefined
  if (userId) {
    const [userRow] = await db
      .select({ email: sfUsers.email, name: sfUsers.name })
      .from(sfUsers)
      .where(eq(sfUsers.id, userId))
      .limit(1)
    const contact = await getOwnProfileContact(userId).catch(() => null)
    prefill = {
      name: contact?.displayName || userRow?.name || session?.user?.name || '',
      email: userRow?.email || session?.user?.email || '',
    }
  }

  const { document } = await loadSubscriptionRegistrationFields(definitionId, {
    planId,
    userId,
    prefill,
  })
  const hasCaptchaField = formHasCaptchaField(document.fields)
  const captcha = await resolveFormCaptcha({
    useSiteCaptchaDefault: document.useSiteCaptchaDefault !== false,
    hasCaptchaField,
  })

  return (
    <section className="sf-subscription-intake" aria-label="Subscription registration">
      <p className="settings-hint">Complete this form before checkout. Fields are edited under Forms.</p>
      <FormWidget
        formKey={`sub-reg-${planId}`}
        slotId={`sub-reg-${planId}`}
        definitionId={definitionId}
        heading=""
        fields={document.fields}
        sections={document.sections}
        successMessage={document.successMessage || 'Thanks — your details were saved.'}
        submitLabel={document.submitLabel || 'Continue'}
        useSiteCaptchaDefault={document.useSiteCaptchaDefault !== false}
        captcha={{
          required: captcha.required,
          provider: captcha.provider,
          siteKey: captcha.siteKey,
          misconfiguredReason: captcha.misconfiguredReason,
        }}
      />
    </section>
  )
}
