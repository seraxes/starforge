/**
 * One-off: post + 3-deep comment thread from demo@starforge.local
 * so Demo Admin (or anyone else) can test Hide / Block.
 *
 *   cross-env NODE_OPTIONS="--no-deprecation --import ./scripts/stub-server-only-loader.mjs" tsx scripts/seed-social-hide-block-fixture.mts
 */
import 'dotenv/config'

import { eq } from 'drizzle-orm'

import { db, sfUsers } from '@/core/db'
import { createComment } from '@/modules/social/comments-store'
import { acceptFriendship, requestFriendshipNotifying } from '@/modules/social/friends-store'
import { createPost } from '@/modules/social/posts-store'

const DEMO_EMAIL = 'demo@starforge.local'
const ADMIN_EMAIL = 'admin@starforge.local'

async function userByEmail(email: string) {
  const [row] = await db
    .select({ id: sfUsers.id, name: sfUsers.name, email: sfUsers.email })
    .from(sfUsers)
    .where(eq(sfUsers.email, email))
    .limit(1)
  return row ?? null
}

async function main() {
  const demo = await userByEmail(DEMO_EMAIL)
  const admin = await userByEmail(ADMIN_EMAIL)
  if (!demo) {
    console.error(`Missing ${DEMO_EMAIL}. Run npm run seed first.`)
    process.exit(1)
  }
  if (!admin) {
    console.error(`Missing ${ADMIN_EMAIL}. Run npm run seed first.`)
    process.exit(1)
  }

  // Friends feed: accept a pair so Admin sees Demo’s friends posts.
  const requested = await requestFriendshipNotifying(demo.id, admin.id)
  if (requested.ok || requested.reason === 'already_friends' || requested.reason === 'not_pending') {
    const accepted = await acceptFriendship(admin.id, demo.id)
    console.log('friendship:', accepted.ok ? 'accepted' : accepted.reason)
  } else {
    console.log('friendship request:', requested.reason)
    const accepted = await acceptFriendship(admin.id, demo.id)
    if (accepted.ok) console.log('friendship: accepted')
  }

  const post = await createPost({
    authorUserId: demo.id,
    body: 'Hide/block fixture — Demo Member post. Use ··· to Hide this post or Block Demo Member.',
    audience: 'friends',
  })
  if (!post.ok) {
    console.error('createPost failed:', post.reason)
    process.exit(1)
  }
  console.log('post:', post.post.id)

  const top = await createComment({
    authorUserId: demo.id,
    postId: post.post.id,
    body: 'Level 1 — top comment from Demo Member.',
  })
  if (!top.ok) {
    console.error('top comment failed:', top.reason)
    process.exit(1)
  }
  console.log('comment L1:', top.comment.id)

  const reply = await createComment({
    authorUserId: demo.id,
    postId: post.post.id,
    parentCommentId: top.comment.id,
    body: 'Level 2 — reply from Demo Member.',
  })
  if (!reply.ok) {
    console.error('reply failed:', reply.reason)
    process.exit(1)
  }
  console.log('comment L2:', reply.comment.id)

  const nested = await createComment({
    authorUserId: demo.id,
    postId: post.post.id,
    parentCommentId: reply.comment.id,
    body: 'Level 3 — reply-to-reply from Demo Member (max depth).',
  })
  if (!nested.ok) {
    console.error('nested reply failed:', nested.reason)
    process.exit(1)
  }
  console.log('comment L3:', nested.comment.id)

  console.log('')
  console.log('Signed in as Demo Admin (/login admin@starforge.local), open /feed')
  console.log('and expand replies on the new Demo Member card to try Hide / Block.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
