import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, validateBody } from '../_lib/serverless'
import { createPasswordResetToken } from '../../vessel-app/backend/src/services/userService'
import { buildPasswordResetEmail, sendEmail } from '../../vessel-app/backend/src/services/emailService'

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof forgotPasswordSchema>) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const successMessage = 'If an account exists for that email, we sent password reset instructions.'
  const user = await createPasswordResetToken(normalizedEmail)
  if (user?.reset_token) {
    const emailPayload = buildPasswordResetEmail(user.email, user.reset_token)
    sendEmail(emailPayload).catch((err) => {
      console.error('Failed to send password reset email', err)
    })
  }
  res.json({ message: successMessage })
}

export default compose(cors, errorHandler, validateBody(forgotPasswordSchema))(handler)
