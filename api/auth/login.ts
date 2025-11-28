import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import * as jwt from 'jsonwebtoken'
import { compose, cors, errorHandler, validateBody, withDatabase } from '../_lib/serverless'
import {
  comparePassword,
  findUserByEmail,
  presentUser,
  type DbUser,
} from '../../vessel-app/backend/src/services/userService'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof loginSchema>) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const user = await findUserByEmail(normalizedEmail)

  if (!user) {
    return res.status(404).json({ message: 'No account found for that email.' })
  }
  const passwordOk = await comparePassword(user, payload.password.trim())
  if (!passwordOk) {
    return res.status(401).json({ message: 'Incorrect password. Please try again.' })
  }
  if (!user.is_verified) {
    return res
      .status(403)
      .json({ message: 'Please verify your email before signing in.', needsVerification: true })
  }

  const token = createToken(user)
  res.json({
    token,
    user: presentUser(user),
  })
}

export default compose(withDatabase, cors, errorHandler, validateBody(loginSchema))(handler)
