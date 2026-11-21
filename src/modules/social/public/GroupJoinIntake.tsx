import React from 'react'

import { resolveFormCaptcha } from '@/core/security/captcha'
import { FormWidget } from '@/modules/form/api'
import { formHasCaptchaField, loadFormDefinition } from '@/modules/forms/api'

type Props = {
  groupId: string
  formDefinitionId: string
}

/**
 * Optional Forms join questions for a closed group (schema owned by product:forms).
 */
export async function GroupJoinIntake({ groupId, formDefinitionId }: Props) {
  const definitionId = formDefinitionId.trim()
  if (!definitionId) return null

  const loaded = await loadFormDefinition(definitionId)
  if (loaded.isFallback || !loaded.document?.fields?.length) return null
  const document = loaded.document
  const hasCaptchaField = formHasCaptchaField(document.fields)
  const captcha = await resolveFormCaptcha({
    useSiteCaptchaDefault: document.useSiteCaptchaDefault !== false,
    hasCaptchaField,
  })

  return (
    <section className="sf-social-group-join-form" aria-label="Join questions">
      <p className="settings-hint">
        Complete this form when requesting to join. Fields are edited under Forms.
      </p>
      <FormWidget
        formKey={`social-group-join-${groupId}`}
        slotId={`social-group-join-${groupId}`}
        definitionId={definitionId}
        heading=""
        fields={document.fields}
        sections={document.sections}
        successMessage={document.successMessage || 'Thanks — your details were saved.'}
        submitLabel={document.submitLabel || 'Submit'}
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
