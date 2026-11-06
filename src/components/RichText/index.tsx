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

import { RichContent } from '@/core/rich-editor/RichContent'
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

function isLexicalState(data: unknown): data is SerializedEditorState {
  if (!data || typeof data !== 'object') return false
  const root = (data as { root?: unknown }).root
  return Boolean(root && typeof root === 'object')
}

/**
 * Public page body — TipTap HTML (canonical) or legacy Lexical JSON
 * (`product:lexical-editor`; still rendered when that module is off so old pages do not blank).
 */
export function RichText({
  data,
}: {
  data: SerializedEditorState | Page['body'] | string | null | undefined
}) {
  if (!data) {
    return null
  }

  if (typeof data === 'string') {
    return <RichContent html={data} className="cms-richtext" />
  }

  if (isLexicalState(data)) {
    return (
      <PayloadRichText className="cms-richtext" converters={jsxConverters} data={data} />
    )
  }

  return null
}
