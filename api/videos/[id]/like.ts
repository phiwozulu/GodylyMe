import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../../_lib/serverless'
import { getPgPool } from '../../_lib/clients'
import { initDatabase } from '../../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const { id } = req.query
  const pool = getPgPool()

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Video ID parameter is required' })
  }

  try {
    // Check if video exists
    const videoResult = await pool.query(
      'SELECT user_id FROM videos WHERE id = $1',
      [id]
    )

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Video not found' })
    }

    const videoOwnerId = videoResult.rows[0].user_id

    if (req.method === 'POST') {
      // Like video
      await pool.query(`
        INSERT INTO video_likes (video_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (video_id, user_id) DO NOTHING
      `, [id, userId])

      // Create notification if not self-like
      if (videoOwnerId !== userId) {
        await pool.query(`
          INSERT INTO notifications (user_id, type, actor_id, target_id)
          VALUES ($1, 'like', $2, $3)
        `, [videoOwnerId, userId, id])
      }

      // Get updated like count
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM video_likes WHERE video_id = $1',
        [id]
      )

      res.json({ count: parseInt(countResult.rows[0].count) || 0 })
    } else if (req.method === 'DELETE') {
      // Unlike video
      await pool.query(`
        DELETE FROM video_likes
        WHERE video_id = $1 AND user_id = $2
      `, [id, userId])

      // Get updated like count
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM video_likes WHERE video_id = $1',
        [id]
      )

      res.json({ count: parseInt(countResult.rows[0].count) || 0 })
    } else {
      return res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error managing video like:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
