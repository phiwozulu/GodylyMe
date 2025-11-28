import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, validateBody, withDatabase } from '../_lib/serverless'
import { findUserByEmail, updateVerificationCode } from '../../vessel-app/backend/src/services/userService'
import { buildVerificationEmail, sendEmail } from '../../vessel-app/backend/src/services/emailService'

const resendSchema = z.object({
  email: z.string().email(),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof resendSchema>) {
  const user = await findUserByEmail(payload.email.trim().toLowerCase())
  if (!user) {
    return res.status(404).json({ message: 'No account found for that email.' })
  }
  if (user.is_verified) {
    return res.status(400).json({ message: 'This account is already verified.' })
  }
  const updated = await updateVerificationCode(user.id)
  if (!updated?.verification_token) {
    return res.status(500).json({ message: 'Unable to generate verification token. Try again later.' })
  }
  const emailPayload = buildVerificationEmail(updated.email, updated.verification_token)
  sendEmail(emailPayload).catch((err) => {
    console.error('Failed to send verification email', err)
  })
  res.json({ message: 'Verification code resent.' })
}

export default compose(withDatabase, cors, errorHandler, validateBody(resendSchema))(handler)
