/**
 * Server resolve for media encode choice (decode → WebP / resize).
 * Pure helpers live in `pipeline.ts`; this loads the session + saved rules.
 */

import 'server-only'

import { getAccessViewer, getAdminAccessViewer } from '@/core/acl/access'

import {
  clampMediaEncodeFlags,
  resolveMediaEncodePolicy,
  type MediaEncodePolicy,
} from './pipeline'
import { getMediaPipelineRules } from './settings-store'

/** Current viewer’s encode policy from Media settings group maps. */
export async function getMediaEncodePolicy(): Promise<MediaEncodePolicy> {
  const [adminViewer, publicViewer, rules] = await Promise.all([
    getAdminAccessViewer(),
    getAccessViewer(),
    getMediaPipelineRules(),
  ])
  const viewer = adminViewer.userId ? adminViewer : publicViewer
  return resolveMediaEncodePolicy(viewer, rules)
}

/** Parse FormData checkbox flags and clamp against the current viewer policy. */
export async function resolvePostedMediaEncodeFlags(formData: FormData): Promise<{
  decodeToWebp: boolean
  resize: boolean
  policy: MediaEncodePolicy
}> {
  const policy = await getMediaEncodePolicy()
  const flags = clampMediaEncodeFlags(policy, {
    decodeToWebp: formData.get('decodeToWebp') === 'on',
    resize: formData.get('resize') === 'on',
  })
  return { ...flags, policy }
}
