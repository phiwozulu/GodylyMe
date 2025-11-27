import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, validateBody } from '../_lib/serverless'
import {
  createUser,
  findUserByEmail,
  findUserByHandle,
  presentUser,
} from '../../vessel-app/backend/src/services/userService'
import { buildVerificationEmail, sendEmail } from '../../vessel-app/backend/src/services/emailService'

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

  if (user.verification_token) {
    const emailPayload = buildVerificationEmail(user.email, user.verification_token)
    sendEmail(emailPayload).catch((err: unknown) => {
      console.error('Failed to send verification email', err)
    })
  }

  res.status(201).json({
    message: 'Account created. Enter the verification code we sent to your email.',
    user: presentUser(user),
  })
}

export default compose(cors, errorHandler, validateBody(signupSchema))(handler)
