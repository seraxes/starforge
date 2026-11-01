import React from 'react'

import { resolveFormCaptcha } from '@/core/forms/captcha'
import { readFormConfig } from '@/core/forms/config'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { FormWidget } from './FormWidget'

/**
 * Core Form particle — placeable contact/custom form.
 * Config (fields, success message, captcha opt-in) lives on the layout slot.
 * Submissions → `sf_form_submissions`. Gated by product:forms + particle toggle.
 */
export const formModule: StarforgeModule = {
  id: 'form',
  name: 'Form',
  description:
    'Contact / custom form (name, email, message by default). Submissions in Admin → Forms. Optional Site Chrome captcha (Turnstile).',
  defaultWidth: 50,
  navViews: [{ key: 'admin', label: 'Forms (submissions)', href: '/app/admin/forms' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
      return null
    }

    const cfg = readFormConfig(slot.config)
    const captcha = await resolveFormCaptcha({
      useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
    })

    return React.createElement(FormWidget, {
      formKey: slot.id,
      slotId: slot.id,
      heading: cfg.heading,
      fields: cfg.fields ?? [],
      successMessage: cfg.successMessage ?? 'Thanks — your message was sent.',
      submitLabel: cfg.submitLabel ?? 'Send',
      useSiteCaptchaDefault: cfg.useSiteCaptchaDefault !== false,
      captcha: {
        required: captcha.required,
        provider: captcha.provider,
        siteKey: captcha.siteKey,
        misconfiguredReason: captcha.misconfiguredReason,
      },
    })
  },
}
