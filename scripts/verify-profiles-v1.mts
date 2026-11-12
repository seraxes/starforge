/**
 * Smoke: product:profiles v1 — schema + admin/public routes + Persona contract.
 * Run: npx tsx scripts/verify-profiles-v1.mts
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function mustExist(rel: string) {
  assert.ok(existsSync(path.join(ROOT, rel)), `missing ${rel}`)
}

mustExist('src/modules/profiles/manifest.ts')
mustExist('src/modules/profiles/schema.ts')
mustExist('src/modules/profiles/store.ts')
mustExist('src/modules/profiles/actions.ts')
mustExist('src/modules/profiles/api.server.ts')
mustExist('src/modules/profiles/fields.ts')
mustExist('src/modules/profiles/privacy.ts')
mustExist('src/modules/profiles/admin/ProfilesListPage.tsx')
mustExist('src/modules/profiles/admin/ProfilesSettingsPage.tsx')
mustExist('src/modules/profiles/admin/ProfileEditPage.tsx')
mustExist('src/modules/profiles/components/ProfileEditor.tsx')
mustExist('src/app/(frontend)/(public)/[locale]/account/profile/page.tsx')
mustExist('src/app/(frontend)/(public)/[locale]/u/[handle]/page.tsx')
mustExist('src/core/db/migrations/0014_profiles_member_media.sql')
mustExist('src/modules/media/member.ts')
mustExist('src/modules/media/admin/MemberMediaPicker.tsx')
mustExist('src/modules/media/admin/ImageFrameEditor.tsx')
mustExist('src/modules/media/admin/FramedImage.tsx')
mustExist('src/modules/media/image-frame.ts')
mustExist('src/core/db/migrations/0015_profile_image_frames.sql')

const manifest = read('src/modules/profiles/manifest.ts')
assert.match(manifest, /id: 'product:profiles'/)
assert.match(manifest, /path: 'profiles'/)
assert.match(manifest, /path: 'profiles\/settings'/)
assert.match(manifest, /path: 'profiles\/\[userId\]'/)
assert.match(manifest, /requires:\s*\['product:media', 'product:forms'\]/)

const schema = read('src/modules/profiles/schema.ts')
assert.match(schema, /sf_profiles|sfProfiles/)
assert.match(schema, /handle/)
assert.match(schema, /extensions/)
assert.match(schema, /visibility/)

const api = read('src/modules/profiles/api.server.ts')
assert.match(api, /export async function getPersonas/)
assert.match(api, /export async function getPersonaByHandle/)
assert.match(api, /getAgeYearsForEligibility/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /product:profiles/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /product:profiles/)
assert.match(registry, /\/admin\/profiles/)

const listShim = read('src/app/(frontend)/admin/(modules)/profiles/page.tsx')
assert.match(listShim, /@\/modules\/profiles\/admin\/ProfilesListPage/)

const settingsShim = read(
  'src/app/(frontend)/admin/(modules)/profiles/settings/page.tsx',
)
assert.match(settingsShim, /@\/modules\/profiles\/admin\/ProfilesSettingsPage/)

const editShim = read(
  'src/app/(frontend)/admin/(modules)/profiles/[userId]/page.tsx',
)
assert.match(editShim, /@\/modules\/profiles\/admin\/ProfileEditPage/)

const migration = read('src/core/db/migrations/0014_profiles_member_media.sql')
assert.match(migration, /CREATE TABLE "sf_profiles"/)
assert.match(migration, /CREATE TABLE "sf_media_owners"/)

const frames = read('src/core/db/migrations/0015_profile_image_frames.sql')
assert.match(frames, /avatar_frame/)
assert.match(frames, /cover_frame/)

const imageFrame = read('src/modules/media/image-frame.ts')
assert.match(imageFrame, /export type ImageFrame/)
assert.match(imageFrame, /normalizeImageFrame/)

const toggles = read('src/core/settings/module-toggles.ts')
assert.match(toggles, /profiles:\s*'product:profiles'/)

const acl = read('src/core/acl/types.ts')
assert.match(acl, /admin\.profiles/)

const css = read('src/app/(frontend)/styles.css')
assert.match(css, /product:profiles/)
assert.match(css, /\.sf-profile\b/)
assert.match(css, /\.sf-member-media\b/)

console.log('verify-profiles-v1: ok')
