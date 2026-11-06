import { Color } from '@tiptap/extension-color'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Underline from '@tiptap/extension-underline'
import StarterKit from '@tiptap/starter-kit'
import type { Extensions } from '@tiptap/react'

import { SfCallout } from './nodes/callout'
import { SfGallery } from './nodes/gallery'
import { SfVideo } from './nodes/video'

/** Image node with optional Payload/Media `data-media-id`. */
export const SfImage = Image.extend({
  name: 'sfImage',
  addAttributes() {
    return {
      ...this.parent?.(),
      mediaId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-media-id'),
        renderHTML: (attributes) => {
          if (!attributes.mediaId) return {}
          return { 'data-media-id': String(attributes.mediaId) }
        },
      },
    }
  },
})

export type RichEditorPreset = 'full' | 'compact'

export function createRichEditorExtensions(options?: {
  preset?: RichEditorPreset
  placeholder?: string
}): Extensions {
  const preset = options?.preset ?? 'full'
  const headingLevels: (1 | 2 | 3 | 4)[] = preset === 'compact' ? [2, 3] : [1, 2, 3, 4]

  return [
    StarterKit.configure({
      heading: { levels: headingLevels },
      codeBlock: preset === 'full' ? {} : false,
      blockquote: preset === 'full' ? {} : false,
      horizontalRule: preset === 'full' ? {} : false,
    }),
    Underline,
    TextStyle,
    Color,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    SfImage.configure({
      allowBase64: false,
      HTMLAttributes: {
        class: 'sf-rich-img',
      },
    }),
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    Placeholder.configure({
      placeholder: options?.placeholder ?? 'Write content…',
    }),
    ...(preset === 'full' ? [SfCallout, SfVideo, SfGallery] : []),
  ]
}
