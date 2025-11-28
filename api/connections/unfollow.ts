import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, requireAuth, validateBody } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

const unfollowSchema = z.object({
  handle: z.string().min(1),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof unfollowSchema>) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Find the user to unfollow by handle
    const targetResult = await pool.query(
      'SELECT id FROM users WHERE handle = $1',
      [payload.handle.toLowerCase()]
    )

    if (targetResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const targetUserId = targetResult.rows[0].id

    // Delete follow relationship
    const deleteResult = await pool.query(
      'DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2',
      [userId, targetUserId]
    )

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: 'You are not following this user' })
    }

    res.json({ message: 'Successfully unfollowed user' })
  } catch (error) {
    console.error('Error unfollowing user:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth, validateBody(unfollowSchema))(handler)
