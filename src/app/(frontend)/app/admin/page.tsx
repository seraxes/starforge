import { redirect } from 'next/navigation'

import {
  firstAdminLandingPath,
  getAccessViewer,
  listViewerAllowedAdminResources,
} from '@/core/acl'

/** Core admin home — land on the first area this viewer may open. */
export default async function CoreAdminIndexPage() {
  const viewer = await getAccessViewer()
  const allowed = viewer.isAppAdmin
    ? new Set<never>()
    : await listViewerAllowedAdminResources(viewer)
  redirect(
    firstAdminLandingPath({
      isAppAdmin: viewer.isAppAdmin,
      allowed,
    }),
  )
}
