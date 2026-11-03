import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { shouldUseSecureCookies } from './secure-cookies'

const saved = { ...process.env }

function restore() {
  for (const key of Object.keys(process.env)) {
    if (!(key in saved)) delete process.env[key]
  }
  Object.assign(process.env, saved)
}

describe('shouldUseSecureCookies', () => {
  it('keeps Secure off for http://localhost', () => {
    try {
      delete process.env.STARFORGE_SECURE_COOKIES
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
      assert.equal(shouldUseSecureCookies(), false)
    } finally {
      restore()
    }
  })

  it('enables Secure for https:// app URL', () => {
    try {
      delete process.env.STARFORGE_SECURE_COOKIES
      process.env.BETTER_AUTH_URL = 'https://starforge.example'
      assert.equal(shouldUseSecureCookies(), true)
    } finally {
      restore()
    }
  })

  it('honors STARFORGE_SECURE_COOKIES override', () => {
    try {
      process.env.STARFORGE_SECURE_COOKIES = '0'
      process.env.BETTER_AUTH_URL = 'https://starforge.example'
      assert.equal(shouldUseSecureCookies(), false)
      process.env.STARFORGE_SECURE_COOKIES = '1'
      process.env.BETTER_AUTH_URL = 'http://localhost:3000'
      assert.equal(shouldUseSecureCookies(), true)
    } finally {
      restore()
    }
  })
})
