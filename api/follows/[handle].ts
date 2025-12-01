import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const { handle } = req.query
  const pool = getPgPool()

  if (!handle || typeof handle !== 'string') {
    return res.status(400).json({ message: 'Handle parameter is required' })
  }

  try {
    // Normalize handle - remove @ prefix if present
    const normalizedHandle = handle.startsWith('@')
      ? handle.slice(1).toLowerCase()
      : handle.toLowerCase()

    // Find target user by handle
    const userResult = await pool.query(
      'SELECT id FROM users WHERE handle = $1',
      [normalizedHandle]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const targetUserId = userResult.rows[0].id

    // Prevent following yourself
    if (targetUserId === userId) {
      return res.status(400).json({ message: 'Cannot follow yourself' })
    }

    if (req.method === 'POST') {
      // Follow user
      await pool.query(`
        INSERT INTO user_follows (follower_id, following_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, following_id) DO NOTHING
      `, [userId, targetUserId])

      // Create notification
      await pool.query(`
        INSERT INTO notifications (user_id, type, actor_id)
        VALUES ($1, 'follow', $2)
      `, [targetUserId, userId])

      res.json({ message: 'Followed successfully' })
    } else if (req.method === 'DELETE') {
      // Unfollow user
      await pool.query(`
        DELETE FROM user_follows
        WHERE follower_id = $1 AND following_id = $2
      `, [userId, targetUserId])

      res.json({ message: 'Unfollowed successfully' })
    } else {
      return res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error managing follow status:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
