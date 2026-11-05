/**
 * Pure rule matching — which enabled rules fire for a trigger + payload.
 */

import { evaluateEmailConditionGroup } from './conditions'
import type { EmailRuleMode, EmailRuleRecord } from './types'

export type MatchableEmailRule = Pick<
  EmailRuleRecord,
  'id' | 'enabled' | 'triggerKey' | 'mode' | 'conditions'
>

/**
 * Return rules that should send for this emit (enabled + trigger + conditions).
 * `automatic` and `conditional` both honor the condition group (empty = always).
 * Mode is retained for admin UX / future scheduling differences.
 */
export function matchEmailRulesForTrigger(options: {
  rules: MatchableEmailRule[]
  triggerKey: string
  payload: Record<string, unknown>
}): MatchableEmailRule[] {
  const key = options.triggerKey.trim()
  if (!key) return []
  return options.rules.filter((rule) => {
    if (!rule.enabled) return false
    if (rule.triggerKey.trim() !== key) return false
    const mode: EmailRuleMode =
      rule.mode === 'conditional' ? 'conditional' : 'automatic'
    // Conditional with empty conditions still sends (same as automatic).
    void mode
    return evaluateEmailConditionGroup(rule.conditions, options.payload)
  })
}
