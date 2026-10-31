import type { StarforgeModule } from '../types'

import { customModule } from './custom'
import { pageContentModule } from './page-content'
import { siteHeaderModule } from './site-header'

/** Core particles always registered before extension modules. */
export const builtinParticles: StarforgeModule[] = [
  pageContentModule,
  siteHeaderModule,
  customModule,
]

export { customModule, pageContentModule, siteHeaderModule }
