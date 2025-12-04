import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from '../../_lib/clients'
import * as jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return secret
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  console.log('[LIKE] Request:', req.method, 'Video ID:', req.query.id)

  // Get video ID
  const { id: videoId } = req.query
  if (!videoId || typeof videoId !== 'string') {
    console.error('[LIKE] Invalid video ID')
    return res.status(400).json({ message: 'Video ID is required' })
  }

  // Get user from JWT
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[LIKE] No authorization header')
    return res.status(401).json({ message: 'Unauthorized' })
  }

  let userId: string
  try {
    const token = authHeader.substring(7)
    const payload = jwt.verify(token, getJwtSecret()) as { sub: string }
    userId = payload.sub
    console.log('[LIKE] User ID:', userId)
  } catch (error) {
    console.error('[LIKE] Invalid token:', error)
    return res.status(401).json({ message: 'Invalid token' })
  }

  const pool = getPgPool()

  try {
    // Check if table has correct schema, recreate if not
    const schemaCheck = await pool.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'video_likes' AND column_name = 'video_id'
    `)

    if (schemaCheck.rows.length === 0 || schemaCheck.rows[0].data_type === 'uuid') {
      // Table doesn't exist or has wrong schema - recreate it
      console.log('[LIKE] Recreating video_likes table with correct schema')
      await pool.query('DROP TABLE IF EXISTS video_likes CASCADE')
      await pool.query(`
        CREATE TABLE video_likes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          video_id TEXT NOT NULL,
          user_id UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(video_id, user_id)
        )
      `)
      await pool.query('CREATE INDEX idx_video_likes_video ON video_likes(video_id)')
      await pool.query('CREATE INDEX idx_video_likes_user ON video_likes(user_id)')
    }

    // Verify video exists
    const videoCheck = await pool.query('SELECT id, user_id FROM videos WHERE id = $1', [videoId])
    if (videoCheck.rows.length === 0) {
      console.error('[LIKE] Video not found:', videoId)
      return res.status(404).json({ message: 'Video not found' })
    }
    const videoOwnerId = videoCheck.rows[0].user_id

    if (req.method === 'POST') {
      // Add like
      console.log('[LIKE] Adding like for user:', userId, 'video:', videoId)

      await pool.query(`
        INSERT INTO video_likes (video_id, user_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (video_id, user_id) DO NOTHING
      `, [videoId, userId])

      // Create notification if not self-like
      if (videoOwnerId !== userId) {
        await pool.query(`
          INSERT INTO notifications (user_id, type, actor_id, target_id, created_at)
          VALUES ($1, 'like', $2, $3, NOW())
        `, [videoOwnerId, userId, videoId])
      }

      // Get count
      const countResult = await pool.query(
        'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
        [videoId]
      )
      const count = countResult.rows[0].count

      console.log('[LIKE] Like added, total count:', count)
      return res.json({ count })

    } else if (req.method === 'DELETE') {
      // Remove like
      console.log('[LIKE] Removing like for user:', userId, 'video:', videoId)

      await pool.query(
        'DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2',
        [videoId, userId]
      )

      // Get count
      const countResult = await pool.query(
        'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
        [videoId]
      )
      const count = countResult.rows[0].count

      console.log('[LIKE] Like removed, total count:', count)
      return res.json({ count })

    } else {
      return res.status(405).json({ message: 'Method not allowed' })
    }

  } catch (error) {
    console.error('[LIKE] Error:', error)
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Internal server error',
      error: String(error)
    })
  }
}
