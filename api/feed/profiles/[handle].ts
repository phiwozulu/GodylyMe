import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler } from '../../_lib/serverless'
import { getPgPool } from '../../_lib/clients'
import { initDatabase } from '../../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const { handle } = req.query
  const pool = getPgPool()

  if (!handle || typeof handle !== 'string') {
    return res.status(400).json({ message: 'Handle parameter is required' })
  }

  try {
    // Find user by handle
    const userResult = await pool.query(
      'SELECT id FROM users WHERE handle = $1',
      [handle.toLowerCase()]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const targetUserId = userResult.rows[0].id

    // Get user's videos
    const result = await pool.query(`
      SELECT
        v.id,
        v.title,
        v.description,
        v.video_url,
        v.thumbnail_url,
        v.duration_seconds,
        v.created_at,
        u.id as user_id,
        u.handle,
        u.name,
        u.photo_url,
        (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) as likes_count,
        (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) as comments_count,
        (SELECT COUNT(*) FROM video_shares WHERE video_id = v.id) as shares_count
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE v.user_id = $1
      ORDER BY v.created_at DESC
    `, [targetUserId])

    const videos = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      videoUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url,
      durationSeconds: row.duration_seconds,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        handle: row.handle,
        name: row.name,
        photoUrl: row.photo_url,
      },
      stats: {
        likes: parseInt(row.likes_count) || 0,
        comments: parseInt(row.comments_count) || 0,
        shares: parseInt(row.shares_count) || 0,
      },
      isLiked: false,
    }))

    res.json({ videos })
  } catch (error) {
    console.error('Error fetching profile videos:', error)
    throw error
  }
}

export default compose(cors, errorHandler)(handler)
