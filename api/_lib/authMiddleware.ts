import type { VercelRequest, VercelResponse } from '@vercel/node'
import * as jwt from 'jsonwebtoken'
import type { Handler } from './serverless'

export type AuthenticatedRequest = VercelRequest & {
  userId?: string
  userEmail?: string
  userHandle?: string
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return secret
}

export function requireAuth(handler: (req: AuthenticatedRequest, res: VercelResponse) => Promise<void | VercelResponse>): Handler {
  return async (req: VercelRequest, res: VercelResponse) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7)
    try {
      const payload = jwt.verify(token, getJwtSecret()) as {
        sub: string
        email: string
        handle: string
      }

      const authenticatedReq = req as AuthenticatedRequest
      authenticatedReq.userId = payload.sub
      authenticatedReq.userEmail = payload.email
      authenticatedReq.userHandle = payload.handle

      return handler(authenticatedReq, res)
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }
  }
}
