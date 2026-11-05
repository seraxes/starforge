import type { StarforgeModule } from '../types'

import { copyrightModule } from './copyright'
import { customModule } from './custom'
import { localeSwitcherModule } from './locale-switcher'
import { loginModule } from './login'
import { logoModule } from './logo'
import { menuModule } from './menu'
import { pageContentModule } from './page-content'
import { siteHeaderModule } from './site-header'
import { socialModule } from './social'
import { spacerModule } from './spacer'

/** Core particles always registered before extension modules. */
export const builtinParticles: StarforgeModule[] = [
  pageContentModule,
  siteHeaderModule,
  logoModule,
  menuModule,
  localeSwitcherModule,
  copyrightModule,
  socialModule,
  spacerModule,
  customModule,
  loginModule,
]

export {
  copyrightModule,
  customModule,
  localeSwitcherModule,
  loginModule,
  logoModule,
  menuModule,
  pageContentModule,
  siteHeaderModule,
  socialModule,
  spacerModule,
}

export {
  defaultConfigForModule,
  defaultCopyrightConfig,
  defaultLocaleSwitcherConfig,
  defaultLoginConfig,
  defaultLogoConfig,
  defaultMenuConfig,
  defaultSocialConfig,
  defaultSpacerConfig,
  readCopyrightConfig,
  readLocaleSwitcherConfig,
  readLoginConfig,
  readLogoConfig,
  readMenuConfig,
  readSocialConfig,
  readSpacerConfig,
} from './config'
export type {
  CopyrightParticleConfig,
  LocaleSwitcherParticleConfig,
  LoginParticleConfig,
  LogoParticleConfig,
  LogoParticleMode,
  MenuParticleConfig,
  SocialLinkItem,
  SocialParticleConfig,
  SpacerParticleConfig,
} from './config'
