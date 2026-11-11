import { z } from 'zod'

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email')

const passwordField = z.string().min(8, 'Password must be at least 8 characters').max(128)

/** Shared request/form schemas for core app auth (not Payload CMS). */
export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: emailField,
  password: passwordField,
})

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required').max(128),
  rememberMe: z.boolean().optional().default(true),
})

export const forgotPasswordSchema = z.object({
  email: emailField,
})

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset link is missing or expired'),
  password: passwordField,
  confirmPassword: z.string().min(1, 'Confirm your new password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/** Login is email-based; this reminds the user of their sign-in email. */
export const forgotUsernameSchema = z.object({
  email: emailField,
})

export const magicLinkSchema = z.object({
  email: emailField,
})

export const emailOtpRequestSchema = z.object({
  email: emailField,
})

export const emailOtpVerifySchema = z.object({
  email: emailField,
  otp: z
    .string()
    .trim()
    .min(4, 'Enter the code from your email')
    .max(12, 'Enter the code from your email'),
  rememberMe: z.boolean().optional().default(true),
})

export const twoFactorCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(6, 'Enter your authenticator or recovery code')
    .max(32, 'Enter your authenticator or recovery code'),
  trustDevice: z.boolean().optional().default(false),
  mode: z.enum(['totp', 'backup']).optional().default('totp'),
})

export const enableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Current password is required').max(128),
})

export const disableTwoFactorSchema = z.object({
  password: z.string().min(1, 'Current password is required').max(128),
})

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Current password is required').max(128),
})

export const verifyTotpEnrollSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ForgotUsernameInput = z.infer<typeof forgotUsernameSchema>
