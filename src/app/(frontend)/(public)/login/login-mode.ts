export type LoginMode = 'password' | 'magic' | 'otp'

export function parseLoginMode(raw: string | undefined | null): LoginMode {
  if (raw === 'magic' || raw === 'otp' || raw === 'password') return raw
  return 'password'
}
