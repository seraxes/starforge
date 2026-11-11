/**
 * product:email-manager server API — emit triggers + Mailer-backed test send.
 */

import 'server-only'

export {
  EMAIL_MANAGER_MODULE_ID,
  emitEmailTrigger,
  isEmailManagerEnabled,
  sendEmailManagerTest,
} from './engine'

export {
  createEmailRule,
  createEmailTemplate,
  deleteEmailRule,
  deleteEmailTemplate,
  findEmailRuleById,
  findEmailTemplateById,
  listEmailRules,
  listEmailTemplates,
  setEmailRuleEnabled,
  updateEmailRule,
  updateEmailTemplate,
} from './store'

export {
  ensureFormsEmailStartersSeeded,
  seedFormsEmailStarters,
} from './forms-starters'
