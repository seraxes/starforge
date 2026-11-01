import type { StarforgeModule } from '../types'

import { copyrightModule } from './copyright'
import { customModule } from './custom'
import { logoModule } from './logo'
import { menuModule } from './menu'
import { pageContentModule } from './page-content'
import { siteHeaderModule } from './site-header'
import { socialModule } from './social'

/** Core particles always registered before extension modules. */
export const builtinParticles: StarforgeModule[] = [
  pageContentModule,
  siteHeaderModule,
  logoModule,
  menuModule,
  copyrightModule,
  socialModule,
  customModule,
]

export {
  copyrightModule,
  customModule,
  logoModule,
  menuModule,
  pageContentModule,
  siteHeaderModule,
  socialModule,
}

export {
  defaultConfigForModule,
  defaultCopyrightConfig,
  defaultLogoConfig,
  defaultMenuConfig,
  defaultSocialConfig,
  readCopyrightConfig,
  readLogoConfig,
  readMenuConfig,
  readSocialConfig,
} from './config'
export type {
  CopyrightParticleConfig,
  LogoParticleConfig,
  LogoParticleMode,
  MenuParticleConfig,
  SocialLinkItem,
  SocialParticleConfig,
} from './config'
