import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Edit profile — Starforge',
  description: 'Redirects to Users → account Profile pane.',
}

type Params = Promise<{ userId: string }>

/**
 * Profile edit moved onto the Core Users detail page (Profile pane).
 */
export default async function ProfileEditPage({ params }: { params: Params }) {
  const { userId } = await params
  const id = (userId || '').trim()
  redirect(id ? `/admin/users/${id}#profile` : '/admin/users')
}
