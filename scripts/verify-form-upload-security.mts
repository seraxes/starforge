/**
 * Static checks for Form upload hardening (architecture audit #1).
 * Run: npx tsx scripts/verify-form-upload-security.mts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function mustInclude(rel: string, needle: string | RegExp, label: string) {
  const src = read(rel)
  const ok = typeof needle === 'string' ? src.includes(needle) : needle.test(src)
  if (!ok) {
    console.error(`FAIL: ${label} — expected in ${rel}: ${needle}`)
    process.exit(1)
  }
  console.log(`ok — ${label}`)
}

function mustNotInclude(rel: string, needle: string | RegExp, label: string) {
  const src = read(rel)
  const found = typeof needle === 'string' ? src.includes(needle) : needle.test(src)
  if (found) {
    console.error(`FAIL: ${label} — must not appear in ${rel}: ${needle}`)
    process.exit(1)
  }
  console.log(`ok — ${label}`)
}

mustInclude(
  'src/core/media/privacy.ts',
  "(doc.folder ?? '') === 'forms'",
  'Form folder stays private after the Payload media collection was removed',
)
mustInclude(
  'src/core/media/privacy.ts',
  'doc.private === true',
  'Private flag stays private after the Payload media collection was removed',
)
mustInclude(
  'src/core/media/form-upload.ts',
  'formAttachment: true',
  'Form uploads mark the file as a form attachment',
)
mustInclude(
  'src/core/media/ingest.ts',
  'isPrivate: input.formAttachment === true',
  'Form attachments are stored private',
)
mustInclude(
  'src/core/media/form-upload.ts',
  'isFormUploadSvgBlocked',
  'SVG block helper exported',
)
mustInclude(
  'src/core/media/form-upload.ts',
  'BLOCKED_MIME',
  'SVG MIME blocklist present',
)
mustNotInclude(
  'src/core/media/form-upload.ts',
  "BUILTIN_ALLOWED_MIME = new Set([\n  'image/png',\n  'image/jpeg',\n  'image/jpg',\n  'image/gif',\n  'image/webp',\n  'image/svg+xml'",
  'Built-in allowlist must not admit image/svg+xml',
)
mustInclude(
  'src/modules/forms/actions.ts',
  'fields.filter((f) => f.type !== \'file\')',
  'Legacy fieldsJson strips client file field defs',
)
mustInclude(
  'src/modules/forms/actions.ts',
  'assertFormUploadsAllowed',
  'Pre-upload validation runs before storage',
)
mustInclude(
  'src/modules/forms/actions.ts',
  'ingestFormUploads',
  'Upload helper still present (after captcha)',
)
mustInclude(
  'next.config.ts',
  'bodySizeLimit',
  'Next serverActions bodySizeLimit set',
)
mustInclude(
  'next.config.ts',
  "'12mb'",
  'bodySizeLimit is 12mb (above 10 MiB form cap)',
)
mustInclude(
  'src/app/api/admin/form-attachments/[id]/route.ts',
  "requireAdminArea('admin.forms', 'edit')",
  'Admin attachment route is gated',
)
mustInclude(
  'src/app/api/media/[id]/route.ts',
  'isPrivateFormMedia',
  'Public media id route blocks private form media',
)
mustInclude(
  'src/core/media/privacy.ts',
  'folder',
  'Shared privacy helper for form media',
)
{
  const plugin = path.join(root, 'src/core/media/storage/payload-plugin.ts')
  if (fs.existsSync(plugin)) {
    console.error('FAIL: payload-plugin.ts must be gone (phase 4)')
    process.exit(1)
  }
}

// Order smoke: captcha / rate-limit must appear before ingestFormUploads call site
{
  const src = read('src/modules/forms/actions.ts')
  const captcha = src.indexOf('verifyCaptchaToken')
  const rate = src.indexOf('checkFormRateLimit')
  const ingestCall = src.indexOf('await ingestFormUploads')
  if (captcha < 0 || rate < 0 || ingestCall < 0) {
    console.error('FAIL: missing captcha / rate-limit / ingest call in actions.ts')
    process.exit(1)
  }
  if (!(captcha < ingestCall && rate < ingestCall)) {
    console.error('FAIL: captcha + rate-limit must run before ingestFormUploads')
    process.exit(1)
  }
  console.log('ok — validate/captcha/rate-limit precede upload storage')
}

console.log('verify-form-upload-security: pass')
