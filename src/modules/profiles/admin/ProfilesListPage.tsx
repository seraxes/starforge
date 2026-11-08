import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Profiles — Starforge',
  description: 'Redirects to Users → Accounts (Profiles members directory).',
}

/**
 * Members directory moved to Core Users — keep this route as a redirect so old
 * bookmarks and module nav links land on the single accounts list.
 */
export default function ProfilesListPage() {
  redirect('/admin/users')
}
