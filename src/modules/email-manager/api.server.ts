/**
 * product:email-manager server API — emit triggers + paced broadcasts + test send.
 */

import 'server-only'

import { runSeedEmailStarter, type SeedEmailStarterInput } from './seed-starter'
import {
  createEmailRule,
  createEmailTemplate,
  findEmailRuleById,
  findEmailTemplateById,
  updateEmailRule,
  updateEmailTemplate,
} from './store'

export type { SeedEmailStarterInput }

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

export { recordEmailSend } from './send-log'

/**
 * Idempotent template + rule pair. Uses the store create / update / find functions.
 * `seed` updates when create returns `{ error }` and ignores that update result.
 * `ensure` creates only a missing id and ignores a create `{ error }`.
 * Template and rule are attempted independently.
 */
export async function seedEmailStarter(
  input: SeedEmailStarterInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return runSeedEmailStarter(input, {
    findEmailTemplateById,
    findEmailRuleById,
    createEmailTemplate,
    updateEmailTemplate,
    createEmailRule,
    updateEmailRule,
  })
}
