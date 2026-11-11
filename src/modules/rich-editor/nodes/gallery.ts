import { mergeAttributes, Node } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'

export type GalleryImage = {
  mediaId: string
  src: string
  alt?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sfGallery: {
      setGallery: (images: GalleryImage[]) => ReturnType
      appendGalleryImage: (image: GalleryImage) => ReturnType
    }
  }
}

function imagesFromElement(el: HTMLElement): GalleryImage[] {
  const imgs = Array.from(el.querySelectorAll('img'))
  return imgs
    .map((img) => ({
      mediaId: img.getAttribute('data-media-id') || '',
      src: img.getAttribute('src') || '',
      alt: img.getAttribute('alt') || '',
    }))
    .filter((img) => Boolean(img.src))
}

/** Simple gallery — figure with imgs + data-media-ids. */
export const SfGallery = Node.create({
  name: 'sfGallery',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      images: {
        default: [] as GalleryImage[],
        parseHTML: (el) => imagesFromElement(el),
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-sf="gallery"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const images = (node.attrs.images as GalleryImage[]) || []
    const mediaIds = images.map((i) => i.mediaId).filter(Boolean).join(',')
    const children: Array<[string, Record<string, string>, ...unknown[]]> = images.map((img) => [
      'img',
      {
        src: img.src,
        alt: img.alt || '',
        ...(img.mediaId ? { 'data-media-id': img.mediaId } : {}),
        class: 'sf-rich-img',
      },
    ])

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-sf': 'gallery',
        ...(mediaIds ? { 'data-media-ids': mediaIds } : {}),
        class: 'sf-rich-gallery',
      }),
      ...children,
    ]
  },

  addCommands() {
    return {
      setGallery:
        (images) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { images },
          }),
      appendGalleryImage:
        (image) =>
        ({ state, tr, dispatch }) => {
          const { selection } = state
          if (!(selection instanceof NodeSelection) || selection.node.type.name !== this.name) {
            return false
          }
          const images = [...((selection.node.attrs.images as GalleryImage[]) || []), image]
          if (dispatch) {
            tr.setNodeMarkup(selection.from, undefined, {
              ...selection.node.attrs,
              images,
            })
            dispatch(tr)
          }
          return true
        },
    }
  },
})
