/**
 * product:profiles shared types.
 */

import type { ImageFrame } from '@/modules/media/image-frame'

import type {
  ProfileFieldKey,
  ProfileLink,
  VisibilityScope,
} from './fields'

export const PROFILE_STATUSES = ['active', 'hidden'] as const
export type ProfileStatus = (typeof PROFILE_STATUSES)[number]

export function isProfileStatus(value: unknown): value is ProfileStatus {
  return (
    typeof value === 'string' &&
    (PROFILE_STATUSES as readonly string[]).includes(value)
  )
}

/** Hero packs namespace their vertical fields here (`{ 'hero:asn': { teamName } }`). */
export type ProfileExtensions = Record<string, Record<string, unknown>>

/** Per-field visibility overrides chosen by the member. */
export type ProfileVisibilityMap = Partial<Record<ProfileFieldKey, VisibilityScope>>

/** Full stored record — owner / admin / server use only. Never send to other members. */
export type ProfileRecord = {
  userId: string
  handle: string
  handleChangedAt: Date | null
  displayName: string
  headline: string
  bio: string
  avatarMediaId: string
  coverMediaId: string
  avatarFrame: ImageFrame
  coverFrame: ImageFrame
  /** `YYYY-MM-DD` or ''. */
  birthDate: string
  gender: string
  country: string
  city: string
  latitude: number | null
  longitude: number | null
  website: string
  phone: string
  links: ProfileLink[]
  locale: string
  timezone: string
  visibility: ProfileVisibilityMap
  extensions: ProfileExtensions
  status: ProfileStatus
  createdAt: Date
  updatedAt: Date
}

/** Editable subset (owner / admin form). */
export type ProfileInput = {
  displayName: string
  handle: string
  headline: string
  bio: string
  avatarMediaId: string
  coverMediaId: string
  avatarFrame: ImageFrame
  coverFrame: ImageFrame
  birthDate: string
  gender: string
  country: string
  city: string
  latitude: number | null
  longitude: number | null
  website: string
  phone: string
  links: ProfileLink[]
  locale: string
  timezone: string
  visibility: ProfileVisibilityMap
}

/**
 * Privacy-projected identity — **the contract the whole ecosystem consumes**
 * (Events registrants, Marketplace sellers, Social authors, Chat, search…).
 * Anything the viewer may not see is `null` / empty — callers never re-check privacy.
 * Store `userId` in your own tables; resolve a Persona at render time.
 */
export type Persona = {
  userId: string
  /** '' until the member has a profile row (pre-provision / module off). */
  handle: string
  displayName: string
  headline: string | null
  /** Media id; resolve with `/api/media/<id>` or `resolveMediaById`. '' = none. */
  avatarMediaId: string
  avatarFrame: ImageFrame
  /** Locale-less path (`/u/sera`) — wrap with `withLocalePrefix`. null when no handle. */
  href: string | null
  bio: string | null
  coverMediaId: string | null
  coverFrame: ImageFrame | null
  ageYears: number | null
  gender: string | null
  country: string | null
  city: string | null
  /** Rounded to ~1 km for non-owners. */
  location: { lat: number; lng: number } | null
  website: string | null
  phone: string | null
  links: ProfileLink[]
  isSelf: boolean
}

/**
 * Relationship between the viewer and the profile owner.
 * `friend` is reserved for the Social pack; until then nobody resolves to it.
 */
export type ViewerRelation = 'self' | 'admin' | 'friend' | 'registered' | 'anonymous'

export type ProfilesModuleSettings = {
  /** Days between username changes (0 = unlimited). First change is always free. */
  handleChangeCooldownDays: number
  /** Who may open `/u/[handle]` pages at all. */
  profilePagesVisibility: 'public' | 'registered'
  /** Members may upload their own avatar / cover through the shared Media pipeline. */
  memberUploadsEnabled: boolean
  /** Offer the “Friends only” scope in the editor (turn on when Social ships). */
  allowFriendsScope: boolean
  /** Optional fields switched off for the whole site. */
  disabledFields: ProfileFieldKey[]
  /** Optional fields members must fill in. displayName + handle are always required. */
  requiredFields: ProfileFieldKey[]
  /** Site-wide default visibility per field (members can still override). */
  defaultVisibility: ProfileVisibilityMap
}

export const DEFAULT_PROFILES_MODULE_SETTINGS: ProfilesModuleSettings = {
  handleChangeCooldownDays: 30,
  profilePagesVisibility: 'public',
  memberUploadsEnabled: true,
  allowFriendsScope: false,
  disabledFields: [],
  requiredFields: [],
  defaultVisibility: {},
}

export type ProfilesActionState = {
  error?: string
  ok?: boolean
  message?: string
  /** Handle echoed back after a successful save (for URL previews). */
  handle?: string
}

/** Row on the admin directory — every user, profile or not. */
export type ProfileDirectoryRow = {
  userId: string
  email: string
  userName: string
  role: string
  banned: boolean
  hasProfile: boolean
  handle: string
  displayName: string
  status: ProfileStatus
  avatarMediaId: string
  /** 0–100, share of optional fields filled in. */
  completeness: number
  updatedAt: Date | null
}
