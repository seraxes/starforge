import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  LinkFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * Optional Lexical editor config (product:lexical-editor).
 * TipTap HTML is the default Pages body; keep this for legacy / opt-in Lexical fields.
 */
export const pagesLexicalEditor = lexicalEditor({
  features: ({ defaultFeatures }) => {
    const withoutDefaultsWeReplace = defaultFeatures.filter((feature) => {
      return !['heading', 'link', 'upload', 'toolbarInline'].includes(feature.key)
    })

    return [
      ...withoutDefaultsWeReplace,
      HeadingFeature({
        enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'],
      }),
      LinkFeature({
        enabledCollections: ['pages'],
      }),
      UploadFeature({
        collections: {
          media: {
            fields: [
              {
                name: 'caption',
                type: 'text',
                admin: {
                  description: 'Optional caption shown under the image on the public page.',
                },
              },
            ],
          },
        },
      }),
      FixedToolbarFeature(),
      InlineToolbarFeature(),
    ]
  },
})
