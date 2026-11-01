import {
  DEFAULT_OFFLINE_MESSAGE,
  DEFAULT_SITE_CHROME_NAME,
  getSiteChrome,
  SITE_OFFLINE_RETRY_AFTER_SECONDS,
} from '@/core/site-chrome'

export const dynamic = 'force-dynamic'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function offlineHtml(siteName: string, message: string): string {
  const name = escapeHtml(siteName)
  const body = escapeHtml(message)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Site offline — ${name}</title>
  <style>
    :root {
      --sf-primary: #f2a66a;
      --sf-secondary: #8ebad4;
      --sf-ink: #1c2834;
      --sf-muted: #5a6674;
      --sf-paper: #f5f8fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Segoe UI", "Helvetica Neue", sans-serif;
      color: var(--sf-ink);
      background:
        radial-gradient(1100px 560px at 8% -12%, color-mix(in srgb, var(--sf-primary) 42%, white) 0%, transparent 58%),
        radial-gradient(900px 520px at 100% 0%, color-mix(in srgb, var(--sf-secondary) 38%, white) 0%, transparent 52%),
        linear-gradient(180deg, #eef4fa 0%, var(--sf-paper) 48%, #eef2f6 100%);
      display: grid;
      place-items: center;
      padding: 2rem 1.25rem;
    }
    .inner { max-width: 32rem; text-align: center; }
    .brand { margin: 0 0 0.75rem; font-weight: 700; letter-spacing: 0.02em; }
    h1 { margin: 0 0 0.75rem; font-size: 1.75rem; }
    .lede { margin: 0; color: var(--sf-muted); line-height: 1.5; }
    .login { margin-top: 1.5rem; }
    a { color: #a85220; font-weight: 600; }
  </style>
</head>
<body>
  <main class="inner" data-sf-offline="">
    <p class="brand">${name}</p>
    <h1>Site offline</h1>
    <p class="lede">${body}</p>
    <p class="login"><a href="/login">Admin sign in</a></p>
  </main>
</body>
</html>`
}

/**
 * Internal rewrite target for Site Chrome offline mode.
 * Serves HTML with HTTP 503 (+ Retry-After). URL stays the visitor's path via middleware rewrite.
 */
export async function GET() {
  let siteName = DEFAULT_SITE_CHROME_NAME
  let message = DEFAULT_OFFLINE_MESSAGE
  try {
    const chrome = await getSiteChrome()
    siteName = chrome.siteName || siteName
    message = chrome.offlineMessage || message
  } catch {
    // defaults
  }

  return new Response(offlineHtml(siteName, message), {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': String(SITE_OFFLINE_RETRY_AFTER_SECONDS),
      'Cache-Control': 'no-store',
    },
  })
}
