import React from 'react'

import { resolveFormCaptcha } from '@/core/forms/captcha'
import { mergeParticleWithDefinition, readFormConfig } from '@/core/forms/config'
import { loadFormDefinition } from '@/core/forms/definitions-store'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { FormWidget } from './FormWidget'

/**
 * Core Form particle — binds a Form definition (Admin → Forms) or legacy inline fields.
 * Submissions → `sf_form_submissions`. Gated by product:forms + particle toggle.
 */
export const formModule: StarforgeModule = {
  id: 'form',
  name: 'Form',
  description:
    'Modular Form engine particle — contact and other presets via Admin → Forms. Optional Site Chrome captcha (Turnstile).',
  defaultWidth: 50,
  navViews: [{ key: 'admin', label: 'Forms', href: '/app/admin/forms' }],
  render: async ({ slot, settings }) => {
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
      return null
    }

    const particle = readFormConfig(slot.config)
    let definition = null
    if (particle.formId) {
      const loaded = await loadFormDefinition(particle.formId)
      if (!loaded.isFallback || loaded.source === 'database' || particle.formId === 'contact') {
        definition = {
          title: loaded.document.title,
          fields: loaded.document.fields,
          sections: loaded.document.sections,
          successMessage: loaded.document.successMessage,
          submitLabel: loaded.document.submitLabel,
          useSiteCaptchaDefault: loaded.document.useSiteCaptchaDefault,
        }
      }
    }

    const resolved = mergeParticleWithDefinition(particle, definition)
    const captcha = await resolveFormCaptcha({
      useSiteCaptchaDefault: resolved.useSiteCaptchaDefault,
    })

    return React.createElement(FormWidget, {
      formKey: slot.id,
      slotId: slot.id,
      definitionId: resolved.definitionId,
      heading: resolved.heading,
      fields: resolved.fields,
      sections: resolved.sections,
      successMessage: resolved.successMessage,
      submitLabel: resolved.submitLabel,
      useSiteCaptchaDefault: resolved.useSiteCaptchaDefault,
      captcha: {
        required: captcha.required,
        provider: captcha.provider,
        siteKey: captcha.siteKey,
        misconfiguredReason: captcha.misconfiguredReason,
      },
    })
  },
}
