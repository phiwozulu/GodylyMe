import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, validateBody, withDatabase } from '../_lib/serverless'
import { verifyUserByCode, presentUser } from '../../vessel-app/backend/src/services/userService'

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof verifySchema>) {
  const user = await verifyUserByCode(payload.email, payload.code)
  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification code.' })
  }

  res.json({
    message: 'Email verified. You can now sign in.',
    user: presentUser(user),
  })
}

export default compose(withDatabase, cors, errorHandler, validateBody(verifySchema))(handler)
