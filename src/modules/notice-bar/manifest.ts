import { defineStarforgeModule } from '@/core/modules/define-module'

/** Notice bar extension particle. */
export default defineStarforgeModule({
  id: 'notice-bar',
  kind: 'particle',
  label: 'Notice bar',
  description: 'Dismissible site-wide notice. Seed places it in Header at 100%.',
  version: '0.1.0',
  defaultEnabled: false,
  featureFlag: 'modules',
  importPath: '@/modules/notice-bar',
  exportName: 'noticeBarModule',
})
