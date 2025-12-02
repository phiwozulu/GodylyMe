import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../../_lib/serverless'
import { getPgPool } from '../../_lib/clients'
import { initDatabase } from '../../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  if (req.method === 'DELETE') {
    return handleDeleteVideo(req, res)
  } else {
    return res.status(405).json({ message: 'Method not allowed' })
  }
}

async function handleDeleteVideo(req: VercelRequest, res: VercelResponse) {
  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Extract video ID from query params (Vercel provides this)
    const videoId = req.query.id as string

    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' })
    }

    // Check if the video exists and belongs to the user
    const videoCheck = await pool.query(
      'SELECT user_id FROM videos WHERE id = $1',
      [videoId]
    )

    if (videoCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Video not found' })
    }

    if (videoCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ message: 'You can only delete your own videos' })
    }

    // Delete related data first (comments, likes, shares)
    await pool.query('DELETE FROM video_comments WHERE video_id = $1', [videoId])
    await pool.query('DELETE FROM video_likes WHERE video_id = $1', [videoId])
    await pool.query('DELETE FROM video_shares WHERE video_id = $1', [videoId])

    // Delete the video
    await pool.query('DELETE FROM videos WHERE id = $1', [videoId])

    res.json({ message: 'Video deleted successfully' })
  } catch (error) {
    console.error('Error deleting video:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
