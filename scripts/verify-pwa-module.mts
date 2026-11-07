/**
 * Smoke: product:pwa module wiring (manifest, publicShell, Serwist, proxy).
 * Run: npm run verify:pwa-module
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

mustExist('src/modules/pwa/manifest.ts')
mustExist('src/modules/pwa/settings.ts')
mustExist('src/modules/pwa/build-webmanifest.ts')
mustExist('src/modules/pwa/admin/PwaSettingsPage.tsx')
mustExist('src/modules/pwa/public/PwaHead.tsx')
mustExist('src/modules/pwa/public/PwaRegister.tsx')
mustExist('src/modules/pwa/public/PwaRegisterClient.tsx')
mustExist('src/app/(frontend)/manifest.webmanifest/route.ts')
mustExist('src/app/(frontend)/admin/(modules)/pwa/page.tsx')
mustExist('src/sw.ts')

const pack = read('src/modules/pwa/manifest.ts')
assert.match(pack, /id:\s*'product:pwa'/)
assert.match(pack, /defaultEnabled:\s*false/)
assert.match(pack, /slot:\s*'head'/)
assert.match(pack, /slot:\s*'bodyEnd'/)
assert.match(pack, /path:\s*'pwa'/)

const allowlist = read('starforge.modules.json')
assert.match(allowlist, /product:pwa/)

const toggles = read('src/core/settings/module-toggles.ts')
assert.match(toggles, /pwa:\s*'product:pwa'/)

const index = read('src/modules/manifest-index.ts')
assert.match(index, /pwaManifest/)

const registry = read('src/generated/module-registry.ts')
assert.match(registry, /"product:pwa"/)
assert.match(registry, /defaultEnabled:\s*false/)

const serverRegistry = read('src/generated/module-registry.server.ts')
assert.match(serverRegistry, /PwaHead/)
assert.match(serverRegistry, /PwaRegister/)

const nextConfig = read('next.config.ts')
assert.match(nextConfig, /@serwist\/next/)
assert.match(nextConfig, /register:\s*false/)
assert.match(nextConfig, /swSrc:\s*'src\/sw\.ts'/)

const proxy = read('src/proxy.ts')
assert.ok(proxy.includes('manifest.webmanifest'), 'proxy should exempt manifest.webmanifest')
assert.ok(proxy.includes('/sw.js'), 'proxy should exempt /sw.js path')
assert.ok(proxy.includes('sw\\\\.js') || proxy.includes('sw\\.js'), 'proxy matcher should skip sw.js')

const offline = read('src/core/site-chrome/offline.ts')
assert.match(offline, /manifest\.webmanifest/)
assert.match(offline, /sw\.js/)

const gitignore = read('.gitignore')
assert.match(gitignore, /public\/sw\*/)

const pkg = read('package.json')
assert.match(pkg, /"@serwist\/next"/)
assert.match(pkg, /"serwist"/)
assert.match(pkg, /verify:pwa-module/)

const modulesReadme = read('src/modules/README.md')
assert.match(modulesReadme, /product:pwa/)

console.log('verify-pwa-module: ok')
