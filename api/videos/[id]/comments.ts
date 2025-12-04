import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from '../../_lib/clients'
import * as jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return secret
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { id: videoId } = req.query
  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ message: 'Video ID required' })
  }

  const pool = getPgPool()

  try {
    // Check if table exists and has correct schema
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_comments' AND column_name = 'video_id'
    `)

    // If video_id is UUID (wrong), drop and recreate
    if (schemaCheck.rows.length > 0 && schemaCheck.rows[0].data_type === 'uuid') {
      console.log('[COMMENT] Wrong schema detected, recreating table...')
      await pool.query('DROP TABLE IF EXISTS video_comments CASCADE')
    }

    // Ensure table exists with correct schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    if (req.method === 'GET') {
      const { rows } = await pool.query(`
        SELECT c.id, c.video_id, c.body, c.created_at,
               u.id as user_id, u.handle, u.name, u.photo_url
        FROM video_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.video_id = $1
        ORDER BY c.created_at DESC
      `, [videoId])

      const comments = rows.map(r => ({
        id: r.id,
        videoId: r.video_id,
        body: r.body,
        user: {
          id: r.user_id,
          handle: r.handle,
          name: r.name,
          photoUrl: r.photo_url
        },
        createdAt: r.created_at
      }))

      return res.json({ comments })
    }

    if (req.method === 'POST') {
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized' })
      }

      let userId: string
      try {
        const token = authHeader.substring(7)
        const payload = jwt.verify(token, getJwtSecret()) as { sub: string }
        userId = payload.sub
      } catch {
        return res.status(401).json({ message: 'Invalid token' })
      }

      const { content } = req.body
      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Comment required' })
      }

      const commentId = randomUUID()
      await pool.query(
        `INSERT INTO video_comments (id, video_id, user_id, body) VALUES ($1, $2, $3, $4)`,
        [commentId, videoId, userId, content.trim()]
      )

      const { rows } = await pool.query(
        'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
        [userId]
      )
      const user = rows[0]

      return res.json({
        comment: {
          id: commentId,
          videoId,
          body: content.trim(),
          user: {
            id: user.id,
            handle: user.handle,
            name: user.name,
            photoUrl: user.photo_url
          },
          createdAt: new Date().toISOString()
        }
      })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (error: any) {
    console.error('[COMMENT] Error:', error)
    return res.status(500).json({
      message: error.message || 'Failed',
      error: String(error)
    })
  }
}
