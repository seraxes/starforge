import React from 'react'

import { sanitizeRichHtml } from './sanitize'
import { videoEmbedSrc, type VideoProvider } from './nodes/video'

type Props = {
  html: string | null | undefined
  className?: string
}

type Segment =
  | { kind: 'html'; html: string }
  | { kind: 'embed'; provider: 'youtube' | 'vimeo'; videoId: string }
  | { kind: 'media'; src: string; mediaId?: string }

const VIDEO_SPLIT =
  /<div\b[^>]*\bdata-sf=["']video["'][^>]*(?:\/>|>\s*<\/div>)/gi

function parseSegments(safe: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  const re = new RegExp(VIDEO_SPLIT.source, 'gi')
  let match: RegExpExecArray | null
  while ((match = re.exec(safe))) {
    if (match.index > last) {
      segments.push({ kind: 'html', html: safe.slice(last, match.index) })
    }
    const tag = match[0]
    const provider = (/data-provider=["']([^"']+)["']/i.exec(tag)?.[1] ||
      'youtube') as VideoProvider
    const videoId = /data-id=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    const src = /data-src=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    const mediaId = /data-media-id=["']([^"']+)["']/i.exec(tag)?.[1] || ''

    if (provider === 'media' && src) {
      segments.push({ kind: 'media', src, mediaId: mediaId || undefined })
    } else if ((provider === 'youtube' || provider === 'vimeo') && videoId) {
      segments.push({ kind: 'embed', provider, videoId })
    } else {
      segments.push({ kind: 'html', html: tag })
    }
    last = match.index + tag.length
  }
  if (last < safe.length) {
    segments.push({ kind: 'html', html: safe.slice(last) })
  }
  return segments.length > 0 ? segments : [{ kind: 'html', html: safe }]
}

/**
 * Public/admin read-only render of sanitized rich HTML.
 * Video placeholders become allowlisted embeds or Media `<video>` players.
 */
export function RichContent({ html, className }: Props) {
  const safe = sanitizeRichHtml(html)
  if (!safe) return null

  const segments = parseSegments(safe)

  return (
    <div className={['sf-rich-content', className].filter(Boolean).join(' ')}>
      {segments.map((seg, i) => {
        if (seg.kind === 'html') {
          if (!seg.html) return null
          return (
            <div
              // eslint-disable-next-line react/no-danger
              key={`h-${i}`}
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          )
        }
        if (seg.kind === 'media') {
          return (
            <div key={`m-${i}`} className="sf-rich-video-embed sf-rich-video-file">
              <video
                src={seg.src}
                controls
                playsInline
                preload="metadata"
                data-media-id={seg.mediaId || undefined}
              />
            </div>
          )
        }
        const src = videoEmbedSrc(seg.provider, seg.videoId)
        if (!src) return null
        return (
          <div key={`v-${i}`} className="sf-rich-video-embed">
            <iframe
              src={src}
              title={`${seg.provider} video`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        )
      })}
    </div>
  )
}
