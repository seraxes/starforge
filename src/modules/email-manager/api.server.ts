/**
 * product:email-manager server API — emit triggers + paced broadcasts + test send.
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

export {
  cancelEmailBroadcast,
  enqueueEmailBroadcast,
  ensureEmailBroadcastDrainJob,
  kickDueBroadcasts,
  pauseEmailBroadcast,
  resumeEmailBroadcast,
} from './broadcast-engine'

export {
  findEmailBroadcastById,
  findInFlightBroadcastBySourceKey,
  listEmailBroadcasts,
} from './broadcast-store'

export {
  loadEmailManagerModuleSettings,
  saveEmailManagerModuleSettings,
} from './settings'
