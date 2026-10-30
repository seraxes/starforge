import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  LinkFeature,
  UploadFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

/**
 * Lexical editor for Pages body — headings, lists, links, Media uploads,
 * plus a fixed toolbar so editors get a modern writing surface in /admin.
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
