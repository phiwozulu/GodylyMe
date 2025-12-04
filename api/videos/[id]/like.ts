import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../../_lib/serverless'
import { getPgPool } from '../../_lib/clients'
import { initDatabase } from '../../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[LIKE] Starting like handler for video:', req.query.id, 'method:', req.method)

  try {
    await initDatabase()
    console.log('[LIKE] Database initialized')
  } catch (dbError) {
    console.error('[LIKE] Database initialization failed:', dbError)
    return res.status(500).json({ message: 'Database initialization failed', error: String(dbError) })
  }

  const userId = (req as any).userId
  const { id } = req.query
  const pool = getPgPool()

  console.log('[LIKE] User ID:', userId, 'Video ID:', id)

  if (!id || typeof id !== 'string') {
    console.error('[LIKE] Invalid video ID')
    return res.status(400).json({ message: 'Video ID parameter is required' })
  }

  try {
    // Check if video exists
    console.log('[LIKE] Checking if video exists:', id)
    const videoResult = await pool.query(
      'SELECT user_id FROM videos WHERE id = $1',
      [id]
    )

    if (videoResult.rows.length === 0) {
      console.error('[LIKE] Video not found:', id)
      return res.status(404).json({ message: 'Video not found' })
    }

    console.log('[LIKE] Video found, owner:', videoResult.rows[0].user_id)

    const videoOwnerId = videoResult.rows[0].user_id

    if (req.method === 'POST') {
      // Like video
      console.log('[LIKE] Inserting like:', { videoId: id, userId })
      await pool.query(`
        INSERT INTO video_likes (video_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (video_id, user_id) DO NOTHING
      `, [id, userId])
      console.log('[LIKE] Like inserted successfully')

      // Create notification if not self-like
      if (videoOwnerId !== userId) {
        console.log('[LIKE] Creating notification for owner:', videoOwnerId)
        await pool.query(`
          INSERT INTO notifications (user_id, type, actor_id, target_id)
          VALUES ($1, 'like', $2, $3)
        `, [videoOwnerId, userId, id])
        console.log('[LIKE] Notification created')
      }

      // Get updated like count
      console.log('[LIKE] Getting like count')
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM video_likes WHERE video_id = $1',
        [id]
      )
      const count = parseInt(countResult.rows[0].count) || 0
      console.log('[LIKE] Like count:', count)

      res.json({ count })
    } else if (req.method === 'DELETE') {
      // Unlike video
      console.log('[LIKE] Deleting like:', { videoId: id, userId })
      await pool.query(`
        DELETE FROM video_likes
        WHERE video_id = $1 AND user_id = $2
      `, [id, userId])
      console.log('[LIKE] Like deleted successfully')

      // Get updated like count
      console.log('[LIKE] Getting like count')
      const countResult = await pool.query(
        'SELECT COUNT(*) as count FROM video_likes WHERE video_id = $1',
        [id]
      )
      const count = parseInt(countResult.rows[0].count) || 0
      console.log('[LIKE] Like count:', count)

      res.json({ count })
    } else {
      console.error('[LIKE] Method not allowed:', req.method)
      return res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('[LIKE] Error managing video like:', error)
    console.error('[LIKE] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    const message = error instanceof Error ? error.message : 'Failed to update like status'
    return res.status(500).json({
      message,
      error: String(error)
    })
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
