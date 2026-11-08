import React from 'react'

import { getAccessViewer } from '@/core/acl/access'
import { resolveFormCaptcha } from '@/core/security/captcha'
import { mergeParticleWithDefinition, readFormConfig } from '@/core/forms/config'
import { formHasCaptchaField } from '@/core/forms/definition'
import { loadFormDefinition } from '@/core/forms/definitions-store'
import {
  filterFormFieldsForViewer,
  filterFormSectionsForFields,
} from '@/core/forms/field-access'
import type { StarforgeModule } from '@/core/modules/types'
import { MODULE_IDS, isCatalogModuleEnabled } from '@/core/settings'

import { FormWidget } from './FormWidget'

/**
 * Core Form particle — binds a Form definition (Admin → Forms) or custom JSON schema.
 * Submissions → `sf_form_submissions`. Gated by product:forms + particle toggle.
 */
export const formModule: StarforgeModule = {
  id: 'form',
  name: 'Form',
  description:
    'Modular Form engine particle — pick a Form definition or paste custom JSON. Optional Settings → Security captcha (Turnstile).',
  defaultWidth: 50,
  navViews: [{ key: 'admin', label: 'Forms', href: '/admin/forms' }],
  render: async ({ slot, settings }) => {
    // Graceful no-op when Forms product module is off (palette also hides this particle).
    if (!isCatalogModuleEnabled(settings, MODULE_IDS.forms)) {
      return null
    }

    const particle = readFormConfig(slot.config)
    let definition = null
    if (particle.source !== 'custom' && particle.formId) {
      const loaded = await loadFormDefinition(particle.formId)
      if (!loaded.isFallback || loaded.source === 'database' || particle.formId === 'contact') {
        definition = {
          title: loaded.document.title,
          fields: loaded.document.fields,
          sections: loaded.document.sections,
          successMessage: loaded.document.successMessage,
          successRedirectUrl: loaded.document.successRedirectUrl,
          submitLabel: loaded.document.submitLabel,
          useSiteCaptchaDefault: loaded.document.useSiteCaptchaDefault,
        }
      }
    }

    const resolved = mergeParticleWithDefinition(particle, definition)
    const viewer = await getAccessViewer()
    const fields = filterFormFieldsForViewer(resolved.fields, viewer)
    const sections = filterFormSectionsForFields(resolved.sections, fields)
    const hasCaptchaField = formHasCaptchaField(fields)
    const captcha = await resolveFormCaptcha({
      useSiteCaptchaDefault: resolved.useSiteCaptchaDefault,
      hasCaptchaField,
    })

    return React.createElement(FormWidget, {
      formKey: slot.id,
      slotId: slot.id,
      definitionId: resolved.definitionId,
      heading: resolved.heading,
      fields,
      sections,
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
