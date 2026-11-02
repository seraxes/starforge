'use server'

import { headers } from 'next/headers'
import { APIError } from 'better-auth/api'

import { auth } from './index'
import {
  disableTwoFactorSchema,
  enableTwoFactorSchema,
  verifyTotpEnrollSchema,
} from './schemas'

export type TwoFactorActionState = {
  error?: string
  success?: string
  totpURI?: string
  backupCodes?: string[]
  enabled?: boolean
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    return error.message || fallback
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function enableTwoFactorAction(
  _prev: TwoFactorActionState,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const parsed = enableTwoFactorSchema.safeParse({
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form' }
  }

  try {
    const data = await auth.api.enableTwoFactor({
      body: {
        password: parsed.data.password,
        method: 'totp',
        issuer: 'Starforge',
      },
      headers: await headers(),
    })

    if (data && typeof data === 'object' && 'method' in data && data.method === 'totp') {
      return {
        success:
          'Scan the QR code (or enter the secret) in your authenticator app, then enter a 6-digit code to finish enabling 2FA. Save your recovery codes now — they will not be shown again.',
        totpURI: data.totpURI,
        backupCodes: data.backupCodes,
        enabled: false,
      }
    }

    return {
      success: 'Two-factor setup started. Verify a code to finish.',
      enabled: false,
    }
  } catch (error) {
    return { error: toErrorMessage(error, 'Could not enable two-factor authentication') }
  }
}

export async function verifyTotpEnrollAction(
  _prev: TwoFactorActionState,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const parsed = verifyTotpEnrollSchema.safeParse({
    code: formData.get('code'),
  })
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Invalid form',
      totpURI: String(formData.get('totpURI') ?? '') || undefined,
      backupCodes: String(formData.get('backupCodes') ?? '')
        .split(/\s+/)
        .map((c) => c.trim())
        .filter(Boolean),
    }
  }

  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error: toErrorMessage(error, 'Invalid authenticator code'),
      totpURI: String(formData.get('totpURI') ?? '') || undefined,
      backupCodes: String(formData.get('backupCodes') ?? '')
        .split(/\s+/)
        .map((c) => c.trim())
        .filter(Boolean),
    }
  }

  return {
    success: 'Two-factor authentication is now enabled on your account.',
    enabled: true,
  }
}

export async function disableTwoFactorAction(
  _prev: TwoFactorActionState,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const parsed = disableTwoFactorSchema.safeParse({
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form', enabled: true }
  }

  try {
    await auth.api.disableTwoFactor({
      body: { password: parsed.data.password },
      headers: await headers(),
    })
  } catch (error) {
    return {
      error: toErrorMessage(error, 'Could not disable two-factor authentication'),
      enabled: true,
    }
  }

  return {
    success: 'Two-factor authentication has been turned off.',
    enabled: false,
  }
}

export async function regenerateBackupCodesAction(
  _prev: TwoFactorActionState,
  formData: FormData,
): Promise<TwoFactorActionState> {
  const parsed = enableTwoFactorSchema.safeParse({
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid form', enabled: true }
  }

  try {
    const data = await auth.api.generateBackupCodes({
      body: { password: parsed.data.password },
      headers: await headers(),
    })
    const codes =
      data && typeof data === 'object' && 'backupCodes' in data
        ? (data.backupCodes as string[])
        : []
    return {
      success: 'New recovery codes generated. Store them somewhere safe — old codes no longer work.',
      backupCodes: codes,
      enabled: true,
    }
  } catch (error) {
    return {
      error: toErrorMessage(error, 'Could not regenerate recovery codes'),
      enabled: true,
    }
  }
}
