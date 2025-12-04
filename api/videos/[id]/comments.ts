import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from '../../_lib/clients'
import * as jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  console.log('[COMMENT] Request:', req.method, 'Video ID:', req.query.id)

  // Get video ID
  const { id: videoId } = req.query
  if (!videoId || typeof videoId !== 'string') {
    console.error('[COMMENT] Invalid video ID')
    return res.status(400).json({ message: 'Video ID is required' })
  }

  const pool = getPgPool()

  if (req.method === 'GET') {
    // Get comments - no auth required
    try {
      console.log('[COMMENT] Fetching comments for video:', videoId)

      const result = await pool.query(`
        SELECT
          c.id,
          c.video_id,
          c.body,
          c.created_at,
          u.id as user_id,
          u.handle,
          u.name,
          u.photo_url
        FROM video_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.video_id = $1
        ORDER BY c.created_at DESC
      `, [videoId])

      const comments = result.rows.map(row => ({
        id: row.id,
        videoId: row.video_id,
        body: row.body,
        user: {
          id: row.user_id,
          handle: row.handle,
          name: row.name,
          photoUrl: row.photo_url
        },
        createdAt: row.created_at
      }))

      console.log('[COMMENT] Found', comments.length, 'comments')
      return res.json({ comments })

    } catch (error) {
      console.error('[COMMENT] Error fetching comments:', error)
      return res.status(500).json({
        message: 'Failed to fetch comments',
        error: String(error)
      })
    }
  }

  if (req.method === 'POST') {
    // Post comment - auth required
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[COMMENT] No authorization header')
      return res.status(401).json({ message: 'Unauthorized' })
    }

    let userId: string
    try {
      const token = authHeader.substring(7)
      const payload = jwt.verify(token, getJwtSecret()) as { sub: string }
      userId = payload.sub
      console.log('[COMMENT] User ID:', userId)
    } catch (error) {
      console.error('[COMMENT] Invalid token:', error)
      return res.status(401).json({ message: 'Invalid token' })
    }

    // Get comment body
    const { content } = req.body
    if (!content || typeof content !== 'string' || !content.trim()) {
      console.error('[COMMENT] Invalid comment content')
      return res.status(400).json({ message: 'Comment content is required' })
    }

    try {
      // Verify video exists
      const videoCheck = await pool.query('SELECT id, user_id FROM videos WHERE id = $1', [videoId])
      if (videoCheck.rows.length === 0) {
        console.error('[COMMENT] Video not found:', videoId)
        return res.status(404).json({ message: 'Video not found' })
      }
      const videoOwnerId = videoCheck.rows[0].user_id

      console.log('[COMMENT] Creating comment for user:', userId, 'video:', videoId)

      // Create comment
      const commentId = randomUUID()
      await pool.query(`
        INSERT INTO video_comments (id, video_id, user_id, body, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [commentId, videoId, userId, content.trim()])

      // Create notification if not self-comment
      if (videoOwnerId !== userId) {
        await pool.query(`
          INSERT INTO notifications (user_id, type, actor_id, target_id, created_at)
          VALUES ($1, 'comment', $2, $3, NOW())
        `, [videoOwnerId, userId, videoId])
      }

      // Get user info
      const userResult = await pool.query(
        'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
        [userId]
      )
      const user = userResult.rows[0]

      const comment = {
        id: commentId,
        videoId: videoId,
        body: content.trim(),
        user: {
          id: user.id,
          handle: user.handle,
          name: user.name,
          photoUrl: user.photo_url
        },
        createdAt: new Date().toISOString()
      }

      console.log('[COMMENT] Comment created:', commentId)
      return res.json({ comment })

    } catch (error) {
      console.error('[COMMENT] Error creating comment:', error)
      return res.status(500).json({
        message: 'Failed to create comment',
        error: String(error)
      })
    }
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
