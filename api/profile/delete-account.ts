import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Delete related data first (ignore errors if tables don't exist)
    const deleteOperations = [
      pool.query('DELETE FROM video_comments WHERE user_id = $1', [userId]).catch(() => {}),
      pool.query('DELETE FROM video_likes WHERE user_id = $1', [userId]).catch(() => {}),
      pool.query('DELETE FROM video_shares WHERE user_id = $1', [userId]).catch(() => {}),
      pool.query('DELETE FROM videos WHERE user_id = $1', [userId]).catch(() => {}),
      pool.query('DELETE FROM follows WHERE follower_id = $1 OR following_id = $1', [userId]).catch(() => {}),
    ]

    await Promise.all(deleteOperations)

    // Delete the user
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING email',
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Error deleting account:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
