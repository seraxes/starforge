/**
 * product:email-manager public API (design-module-boundary §6).
 *
 * Other modules should import triggers / pure helpers from here.
 * Runtime emit lives in `api.server.ts` (server-only + Mailer).
 *
 *   import { listEmailTriggers, FORM_SUBMITTED_TRIGGER } from '@/modules/email-manager/api'
 *   import { emitEmailTrigger } from '@/modules/email-manager/api.server'
 */

export {
  BUILTIN_EMAIL_TRIGGERS,
  getEmailTrigger,
  isKnownEmailTriggerKey,
  listEmailTriggers,
} from './triggers'

export {
  evaluateEmailCondition,
  evaluateEmailConditionGroup,
  normalizeEmailConditionGroup,
  resolvePayloadPath,
} from './conditions'

export {
  listMergeFieldsInTemplate,
  renderEmailTemplate,
  renderEmailTemplateString,
} from './template-render'

export { matchEmailRulesForTrigger } from './rule-match'

export {
  normalizeEmailAudience,
  resolveEmailAudience,
  splitEmailList,
} from './audience'

export {
  EMAIL_MODULE_CATEGORIES,
  isEmailModuleCategory,
  isEmailRuleMode,
} from './types'

export type {
  EmailAdminActionState,
  EmailAudience,
  EmailCondition,
  EmailConditionGroup,
  EmailConditionOp,
  EmailModuleCategory,
  EmailRuleMode,
  EmailRuleRecord,
  EmailTemplateRecord,
  EmailTriggerDef,
  EmailTriggerEmitInput,
  EmailTriggerEmitResult,
} from './types'

/** Convenience trigger keys for Forms / system. */
export const FORM_SUBMITTED_TRIGGER = 'product:forms/submitted' as const
export const FORM_TEST_TRIGGER = 'product:forms/test' as const
export const SYSTEM_TEST_TRIGGER = 'system:test' as const

export const EMAIL_MANAGER_MODULE_ID = 'product:email-manager' as const
