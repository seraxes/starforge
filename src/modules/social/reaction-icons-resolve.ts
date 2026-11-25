import 'server-only'

import { resolveMediaById } from '@/modules/media/api.server'

import {
  REACTION_KINDS,
  type ReactionIconImageUrls,
  type ReactionIconMediaIds,
} from './reactions'

export type { ReactionIconImageUrls }

/** Resolve pack-setting media ids to thumbnail URLs for feed / admin preview. */
export async function resolveReactionIconImageUrls(
  mediaIds: ReactionIconMediaIds,
): Promise<ReactionIconImageUrls> {
  const out: ReactionIconImageUrls = {}
  await Promise.all(
    REACTION_KINDS.map(async (kind) => {
      const id = mediaIds[kind]?.trim()
      if (!id) return
      const media = await resolveMediaById(id, { size: 'thumbnail', preferWebp: true })
      if (media?.url) out[kind] = media.url
    }),
  )
  return out
}
