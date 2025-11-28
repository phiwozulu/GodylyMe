import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, requireAuth, validateBody } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

const followSchema = z.object({
  handle: z.string().min(1),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof followSchema>) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Find the user to follow by handle
    const targetResult = await pool.query(
      'SELECT id FROM users WHERE handle = $1',
      [payload.handle.toLowerCase()]
    )

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const targetUserId = targetResult.rows[0].id

    // Can't follow yourself
    if (targetUserId === userId) {
      return res.status(400).json({ message: 'You cannot follow yourself' })
    }

    // Insert follow relationship (ignore if already exists)
    await pool.query(`
      INSERT INTO user_follows (follower_id, following_id, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `, [userId, targetUserId])

    // Create notification for the followed user
    await pool.query(`
      INSERT INTO notifications (user_id, type, actor_id, created_at)
      VALUES ($1, 'follow', $2, NOW())
    `, [targetUserId, userId])

    res.json({ message: 'Successfully followed user' })
  } catch (error) {
    console.error('Error following user:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth, validateBody(followSchema))(handler)
