import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import * as jwt from 'jsonwebtoken'
import { compose, cors, errorHandler, validateBody } from '../_lib/serverless'
import { resetPasswordWithToken, presentUser, type DbUser } from '../../vessel-app/backend/src/services/userService'

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6).max(200),
})

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Set it in Vercel environment variables')
  }
  return secret
}

function createToken(user: DbUser) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      handle: user.handle,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  )
}

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof resetPasswordSchema>) {
  const user = await resetPasswordWithToken(payload.token, payload.password)
  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired reset token.' })
  }
  const token = createToken(user)
  res.json({
    message: 'Password updated. You are now signed in.',
    token,
    user: presentUser(user),
  })
}

export default compose(cors, errorHandler, validateBody(resetPasswordSchema))(handler)
