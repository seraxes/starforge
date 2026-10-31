import { redirect } from 'next/navigation'

/** Core admin home — users list is the first surface. */
export default function CoreAdminIndexPage() {
  redirect('/app/admin/users')
}
