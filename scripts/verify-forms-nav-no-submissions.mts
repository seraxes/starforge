/**
 * Smoke check: Forms admin nav has Forms + Settings only (no Submissions leaf).
 * Run: npx tsx scripts/verify-forms-nav-no-submissions.mts
 */
import { buildAdminNavGroups } from '../src/core/admin-nav/build.ts'

const flags = {
  nav: true,
  forms: true,
  redirects: false,
  layout: true,
  pageSettings: true,
  cms: true,
}

for (const surface of ['core', 'payload'] as const) {
  const groups = buildAdminNavGroups({ surface, flags })
  const forms = groups.find((g) => g.id === 'forms')
  if (!forms) {
    console.error(`[${surface}] missing forms group`)
    process.exit(1)
  }
  const submissions = forms.links.find(
    (l) =>
      l.href.includes('/forms/submissions') || /^submissions$/i.test(l.label.trim()),
  )
  if (submissions) {
    console.error(
      `[${surface}] Forms must not list Submissions nav leaf (prefs deprecate it)`,
      forms.links,
    )
    process.exit(1)
  }
  const settings = forms.links.find((l) => l.href === '/admin/forms/settings')
  if (!settings) {
    console.error(`[${surface}] Forms missing Settings child`, forms.links)
    process.exit(1)
  }
  console.log(`[${surface}] ok — Forms accordion → Forms + Settings (no Submissions)`)
}

console.log('verify-forms-nav-no-submissions: pass')
