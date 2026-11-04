/**
 * App Router shim — Media library UI lives in product:media (M5).
 * Keep this file thin; do not grow Core-hosted library UI here again.
 */
export const dynamic = 'force-dynamic'

export { default, metadata } from '@/modules/media/admin/MediaLibraryPage'
