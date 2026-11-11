import { mergeAttributes, Node } from '@tiptap/core'

export type CalloutVariant = 'info' | 'warning' | 'success'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sfCallout: {
      setCallout: (variant?: CalloutVariant) => ReturnType
    }
  }
}

/** Visual callout / info box — stored as `<div data-sf="callout" data-variant="…">`. */
export const SfCallout = Node.create({
  name: 'sfCallout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info' satisfies CalloutVariant,
        parseHTML: (element) =>
          (element.getAttribute('data-variant') as CalloutVariant | null) || 'info',
        renderHTML: (attributes) => ({
          'data-sf': 'callout',
          'data-variant': attributes.variant,
          class: `sf-rich-callout sf-rich-callout-${attributes.variant}`,
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-sf="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setCallout:
        (variant: CalloutVariant = 'info') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { variant },
            content: [{ type: 'paragraph' }],
          }),
    }
  },
})
