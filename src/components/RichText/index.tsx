import type {
  DefaultNodeTypes,
  SerializedLinkNode,
  SerializedUploadNode,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  type JSXConvertersFunction,
  LinkJSXConverter,
  RichText as PayloadRichText,
  UploadJSXConverter,
} from '@payloadcms/richtext-lexical/react'
import React from 'react'

import type { Page } from '@/payload-types'

type NodeTypes = DefaultNodeTypes

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }): string => {
  const doc = linkNode.fields.doc
  if (!doc) {
    return '#'
  }

  const { relationTo, value } = doc
  if (typeof value !== 'object' || value === null) {
    return '#'
  }

  if (relationTo === 'pages' && 'slug' in value && typeof value.slug === 'string') {
    return `/${value.slug}`
  }

  return `/${relationTo}`
}

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => {
  const uploadConverters = UploadJSXConverter as {
    upload: (args: { node: SerializedUploadNode }) => React.ReactNode
  }

  return {
    ...defaultConverters,
    ...LinkJSXConverter({ internalDocToHref }),
    upload: ({ node }) => {
      const image = uploadConverters.upload({ node })
      const caption =
        typeof node.fields?.caption === 'string' && node.fields.caption.trim()
          ? node.fields.caption
          : null

      if (!image) {
        return null
      }

      if (!caption) {
        return image
      }

      return (
        <figure className="cms-figure">
          {image}
          <figcaption>{caption}</figcaption>
        </figure>
      )
    },
  }
}

export function RichText({ data }: { data: SerializedEditorState | Page['body'] }) {
  if (!data) {
    return null
  }

  return (
    <PayloadRichText
      className="cms-richtext"
      converters={jsxConverters}
      data={data as SerializedEditorState}
    />
  )
}
