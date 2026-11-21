import type { Metadata } from 'next'
import React from 'react'

import SocialMemberFeedPage, {
  generateMetadata as generateMemberMetadata,
} from './SocialMemberFeedPage'

type Args = { params: Promise<{ locale: string; handle: string }> }

export async function generateMetadata(args: Args): Promise<Metadata> {
  return generateMemberMetadata({ ...args, reservedOnly: true })
}

/** Reserved-handle member wall — `/feed/u/[handle]`. */
export default async function SocialMemberFeedReservedPage(args: Args) {
  return SocialMemberFeedPage({ ...args, reservedOnly: true })
}
