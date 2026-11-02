import type { StarforgeModule } from '../types'

import { copyrightModule } from './copyright'
import { customModule } from './custom'
import { loginModule } from './login'
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
  loginModule,
]

export {
  copyrightModule,
  customModule,
  loginModule,
  logoModule,
  menuModule,
  pageContentModule,
  siteHeaderModule,
  socialModule,
}

export {
  defaultConfigForModule,
  defaultCopyrightConfig,
  defaultLoginConfig,
  defaultLogoConfig,
  defaultMenuConfig,
  defaultSocialConfig,
  readCopyrightConfig,
  readLoginConfig,
  readLogoConfig,
  readMenuConfig,
  readSocialConfig,
} from './config'
export type {
  CopyrightParticleConfig,
  LoginParticleConfig,
  LogoParticleConfig,
  LogoParticleMode,
  MenuParticleConfig,
  SocialLinkItem,
  SocialParticleConfig,
} from './config'
