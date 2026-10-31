import type { StarforgeModule } from '../types'

import { copyrightModule } from './copyright'
import { customModule } from './custom'
import { logoModule } from './logo'
import { pageContentModule } from './page-content'
import { siteHeaderModule } from './site-header'
import { socialModule } from './social'

/** Core particles always registered before extension modules. */
export const builtinParticles: StarforgeModule[] = [
  pageContentModule,
  siteHeaderModule,
  logoModule,
  copyrightModule,
  socialModule,
  customModule,
]

export {
  copyrightModule,
  customModule,
  logoModule,
  pageContentModule,
  siteHeaderModule,
  socialModule,
}

export {
  defaultConfigForModule,
  defaultCopyrightConfig,
  defaultLogoConfig,
  defaultSocialConfig,
  readCopyrightConfig,
  readLogoConfig,
  readSocialConfig,
} from './config'
export type {
  CopyrightParticleConfig,
  LogoParticleConfig,
  SocialLinkItem,
  SocialParticleConfig,
} from './config'
