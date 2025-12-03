import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, validateBody } from '../_lib/serverless'
import {
  createUser,
  findUserByEmail,
  findUserByHandle,
  presentUser,
} from '../_lib/userService'
import { buildVerificationEmail, sendEmail } from '../_lib/emailService'

const signupSchema = z.object({
  name: z.string().min(2).max(120),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores.'),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  church: z.string().max(160).optional(),
  country: z.string().max(160).optional(),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof signupSchema>) {
  const normalizedEmail = payload.email.trim().toLowerCase()
  const normalizedHandle = payload.handle.trim().toLowerCase()

  const [existingEmail, existingHandle] = await Promise.all([
    findUserByEmail(normalizedEmail),
    findUserByHandle(normalizedHandle),
  ])

  if (existingEmail) {
    return res.status(409).json({ message: 'Email already registered. Try signing in instead.' })
  }
  if (existingHandle) {
    return res.status(409).json({ message: 'Handle already in use. Pick a different one.' })
  }

  const user = await createUser({
    name: payload.name,
    handle: payload.handle,
    email: normalizedEmail,
    password: payload.password,
    church: payload.church,
    country: payload.country,
  })

  let emailSent = false
  let emailError = null

  if (user.verification_token) {
    const emailPayload = buildVerificationEmail(user.email, user.verification_token)
    try {
      await sendEmail(emailPayload)
      emailSent = true
      console.log('[signup] Verification email sent successfully to:', user.email)
    } catch (err: unknown) {
      emailSent = false
      emailError = err instanceof Error ? err.message : 'Unknown error'
      console.error('[signup] Failed to send verification email:', err)
      console.error('[signup] Email error:', emailError)
    }
  }

  res.status(201).json({
    message: emailSent
      ? 'Account created. Enter the verification code we sent to your email.'
      : 'Account created, but we couldn\'t send the verification email. Please use the resend option or contact support.',
    user: presentUser(user),
    emailSent,
    emailError: emailSent ? undefined : emailError,
  })
}

export default compose(cors, errorHandler, validateBody(signupSchema))(handler)
