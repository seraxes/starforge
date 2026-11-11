import { mergeAttributes, Node } from '@tiptap/core'

export type VideoProvider = 'youtube' | 'vimeo' | 'media'

export type SfVideoAttrs = {
  provider: VideoProvider
  /** YouTube / Vimeo id */
  videoId?: string
  /** Shared Media library id (local disk or S3/Spaces). */
  mediaId?: string
  /** Playable URL for media provider. */
  src?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sfVideo: {
      setVideo: (attrs: SfVideoAttrs) => ReturnType
    }
  }
}

/** Parse YouTube / Vimeo URL or bare id → provider + id. */
export function parseVideoInput(
  raw: string,
): { provider: 'youtube' | 'vimeo'; videoId: string } | null {
  const input = raw.trim()
  if (!input) return null

  const yt =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i.exec(input)
  if (yt?.[1]) return { provider: 'youtube', videoId: yt[1] }

  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(input)
  if (vimeo?.[1]) return { provider: 'vimeo', videoId: vimeo[1] }

  if (/^[A-Za-z0-9_-]{6,20}$/.test(input)) return { provider: 'youtube', videoId: input }
  if (/^\d{6,12}$/.test(input)) return { provider: 'vimeo', videoId: input }

  return null
}

export function videoEmbedSrc(provider: VideoProvider, videoId: string): string | null {
  const id = videoId.trim()
  if (!id) return null
  if (provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`
  if (provider === 'vimeo') return `https://player.vimeo.com/video/${encodeURIComponent(id)}`
  return null
}

/** Atom video block — embed URL or Media library file (local / S3). */
export const SfVideo = Node.create({
  name: 'sfVideo',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      provider: {
        default: 'youtube' satisfies VideoProvider,
        parseHTML: (el) =>
          (el.getAttribute('data-provider') as VideoProvider | null) || 'youtube',
        renderHTML: (attrs) => ({ 'data-provider': attrs.provider }),
      },
      videoId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-id') || '',
        renderHTML: (attrs) => {
          if (!attrs.videoId) return {}
          return { 'data-id': String(attrs.videoId) }
        },
      },
      mediaId: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-media-id') || '',
        renderHTML: (attrs) => {
          if (!attrs.mediaId) return {}
          return { 'data-media-id': String(attrs.mediaId) }
        },
      },
      src: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-src') || '',
        renderHTML: (attrs) => {
          if (!attrs.src) return {}
          return { 'data-src': String(attrs.src) }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-sf="video"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-sf': 'video',
        class: 'sf-rich-video',
      }),
    ]
  },

  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              provider: attrs.provider,
              videoId: attrs.videoId || '',
              mediaId: attrs.mediaId || '',
              src: attrs.src || '',
            },
          }),
    }
  },
})
