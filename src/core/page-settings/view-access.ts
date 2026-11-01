import 'server-only'

import { canSeeNavAccessTags, getAccessViewer, resolveAccessTags } from '@/core/acl'
import type { ResolvedPageChrome } from './types'

/**
 * Whether the current viewer may see a page given resolved chrome access tags.
 * Empty / public-only tags → public. App admins always pass.
 */
export async function viewerCanSeePageChrome(
  chrome: Pick<ResolvedPageChrome, 'accessTags'> | { accessTags?: string[] },
): Promise<boolean> {
  const tags = resolveAccessTags({ accessTags: chrome.accessTags })
  if (tags.length === 1 && tags[0] === 'public') return true
  const viewer = await getAccessViewer()
  return canSeeNavAccessTags(tags, viewer)
}
