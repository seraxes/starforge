import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/core/auth'
import { syncAuthEmailVerificationPolicy } from '@/core/auth/email-verification-policy'

const handler = toNextJsHandler(auth)

async function withAuthPolicy(
  request: Request,
  method: 'GET' | 'POST',
): Promise<Response> {
  await syncAuthEmailVerificationPolicy()
  return method === 'GET' ? handler.GET(request) : handler.POST(request)
}

export async function GET(request: Request) {
  return withAuthPolicy(request, 'GET')
}

export async function POST(request: Request) {
  return withAuthPolicy(request, 'POST')
}
