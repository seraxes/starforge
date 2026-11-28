'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminArea } from '@/core/acl/access'
import { MODULE_IDS, getSiteSettings, isCatalogModuleEnabled } from '@/core/settings'

import { saveRichEditorModuleSettings } from './pack-settings'

export type RichEditorAdminActionState = {
  ok?: boolean
  error?: string
  message?: string
}

async function requireRichEditorAdmin(): Promise<RichEditorAdminActionState | null> {
  const session = await requireAdminArea('admin.settings', 'edit')
  if (!session) {
    return {
      error:
        'Sign in with Settings access (app admin or ACL → Settings) to manage rich editor options.',
    }
  }
  const settings = await getSiteSettings()
  if (!isCatalogModuleEnabled(settings, MODULE_IDS.richEditor)) {
    return { error: 'Rich editor is disabled. Enable it under Settings → Modules.' }
  }
  return null
}

export async function saveRichEditorSettingsAction(
  _prev: RichEditorAdminActionState,
  formData: FormData,
): Promise<RichEditorAdminActionState> {
  const denied = await requireRichEditorAdmin()
  if (denied) return denied

  try {
    const settings = await saveRichEditorModuleSettings({
      emojiInsertEnabled: formData.get('emojiInsertEnabled') === '1',
    })
    revalidatePath('/admin/rich-editor/settings')
    revalidatePath('/feed')
    return {
      ok: true,
      message: settings.emojiInsertEnabled
        ? 'Emoji insert is on.'
        : 'Emoji insert is off site-wide.',
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : 'Could not save rich editor settings.',
    }
  }
}
