import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, validateBody } from '../_lib/serverless'
import { findUserByEmail, updateVerificationCode } from '../_lib/userService'
import { buildVerificationEmail, sendEmail } from '../_lib/emailService'

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

  // Check if a code was sent recently (within last 2 minutes)
  if (user.verification_token_expires) {
    const lastSentTime = new Date(user.verification_token_expires).getTime() - (1000 * 60 * 60 * 24) // expires is 24h from sent time
    const now = Date.now()
    const twoMinutesInMs = 2 * 60 * 1000
    const timeSinceLastSend = now - lastSentTime

    if (timeSinceLastSend < twoMinutesInMs) {
      const secondsRemaining = Math.ceil((twoMinutesInMs - timeSinceLastSend) / 1000)
      return res.status(429).json({
        message: `Please wait ${secondsRemaining} seconds before requesting another code.`,
        secondsRemaining,
        canResendAt: new Date(lastSentTime + twoMinutesInMs).toISOString()
      })
    }
  }

  const updated = await updateVerificationCode(user.id)
  if (!updated?.verification_token) {
    return res.status(500).json({ message: 'Unable to generate verification token. Try again later.' })
  }
  const emailPayload = buildVerificationEmail(updated.email, updated.verification_token)

  try {
    await sendEmail(emailPayload)
    console.log('[resend] Verification email sent successfully to:', updated.email)
    res.json({
      message: 'Verification code resent. Check your email.',
      emailSent: true
    })
  } catch (err) {
    console.error('[resend] Failed to send verification email:', err)
    res.status(500).json({
      message: 'Unable to send verification email. Please try again later or contact support.',
      emailSent: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    })
  }
}

export default compose(cors, errorHandler, validateBody(resendSchema))(handler)
