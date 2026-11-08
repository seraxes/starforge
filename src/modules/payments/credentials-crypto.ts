import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Encrypt merchant secrets at rest (AES-256-GCM).
 * Key: SF_PAY_CREDENTIALS_KEY or derived from PAYLOAD_SECRET.
 */

function keyBytes(): Buffer {
  const raw =
    process.env.SF_PAY_CREDENTIALS_KEY?.trim() ||
    process.env.PAYLOAD_SECRET?.trim() ||
    'dev-only-payments-credentials-key'
  return createHash('sha256').update(raw).digest()
}

/** Returns base64(iv:tag:ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decryptSecret(cipherB64: string): string {
  const buf = Buffer.from(cipherB64, 'base64')
  if (buf.length < 28) throw new Error('Invalid ciphertext')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const data = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function maskSecret(plain: string): string {
  const t = plain.trim()
  if (t.length <= 4) return '••••'
  return `••••${t.slice(-4)}`
}
