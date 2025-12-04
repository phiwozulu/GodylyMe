import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from '../../_lib/clients'
import * as jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return secret
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { id: videoId } = req.query
  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ message: 'Video ID required' })
  }

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

  const pool = getPgPool()

  try {
    // Simple: just try to ensure table exists every time
    await pool.query(`
      CREATE TABLE IF NOT EXISTS video_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      )
    `)

    if (req.method === 'POST') {
      await pool.query(
        `INSERT INTO video_likes (video_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [videoId, userId]
      )

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
        [videoId]
      )

      return res.json({ count: rows[0].count })
    }

    if (req.method === 'DELETE') {
      await pool.query(
        'DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2',
        [videoId, userId]
      )

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
        [videoId]
      )

      return res.json({ count: rows[0].count })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (error: any) {
    console.error('[LIKE] Error:', error)
    return res.status(500).json({
      message: error.message || 'Failed',
      error: String(error)
    })
  }
}
