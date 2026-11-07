/// <reference lib="webworker" />
/**
 * product:pwa service worker (Serwist).
 * v0: installability + light static/image cache. Navigations stay NetworkOnly —
 * no offline shell / admin / API caching.
 */
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

function isExcludedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/cms') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  )
}

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ request, url }) =>
      request.mode === 'navigate' || isExcludedPath(url.pathname),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ url }) => url.pathname.startsWith('/_next/static/'),
    handler: new CacheFirst({
      cacheName: 'sf-pwa-next-static',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        }),
      ],
    }),
  },
  {
    matcher: ({ request, url }) =>
      request.destination === 'image' && !isExcludedPath(url.pathname),
    handler: new CacheFirst({
      cacheName: 'sf-pwa-images',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 48,
          maxAgeSeconds: 60 * 60 * 24 * 14,
        }),
      ],
    }),
  },
  // Light tile cache for live tactical / venue maps (OSM). Does not enable background GPS.
  {
    matcher: ({ url }) =>
      url.hostname.endsWith('tile.openstreetmap.org') ||
      url.hostname === 'tile.openstreetmap.org',
    handler: new CacheFirst({
      cacheName: 'sf-pwa-map-tiles',
      plugins: [
        new ExpirationPlugin({
          maxEntries: 96,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        }),
      ],
    }),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
})

serwist.addEventListeners()
