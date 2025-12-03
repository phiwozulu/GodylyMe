import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler } from '../../_lib/serverless'
import { getPgPool } from '../../_lib/clients'
import { initDatabase } from '../../_lib/initDatabase'
import * as jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured')
  }
  return secret
}

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const { id } = req.query
  const pool = getPgPool()

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'Video ID parameter is required' })
  }

  if (req.method === 'POST') {
    // POST requires authentication
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid authorization header' })
    }

    const token = authHeader.substring(7)
    let userId: string
    try {
      const payload = jwt.verify(token, getJwtSecret()) as { sub: string }
      userId = payload.sub
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' })
    }

    return handlePostComment(req, res, id as string, userId, pool)
  } else if (req.method === 'GET') {
    // GET does not require authentication
    return handleGetComments(req, res, id as string, pool)
  } else {
    return res.status(405).json({ message: 'Method not allowed' })
  }
}

async function handlePostComment(
  req: VercelRequest,
  res: VercelResponse,
  videoId: string,
  userId: string,
  pool: any
) {
  try {
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' })
    }

    // Check if video exists
    const videoResult = await pool.query(
      'SELECT user_id FROM videos WHERE id = $1',
      [videoId]
    )

    if (videoResult.rows.length === 0) {
      return res.status(404).json({ message: 'Video not found' })
    }

    const videoOwnerId = videoResult.rows[0].user_id

    // Insert comment (using 'body' column for backward compatibility)
    const commentId = randomUUID()
    await pool.query(`
      INSERT INTO video_comments (id, video_id, user_id, body, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [commentId, videoId, userId, content.trim()])

    // Create notification if not self-comment
    if (videoOwnerId !== userId) {
      await pool.query(`
        INSERT INTO notifications (user_id, type, actor_id, target_id)
        VALUES ($1, 'comment', $2, $3)
      `, [videoOwnerId, userId, commentId])
    }

    // Get user info for response
    const userResult = await pool.query(
      'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
      [userId]
    )

    const user = userResult.rows[0]

    res.json({
      comment: {
        id: commentId,
        body: content.trim(),
        user: {
          id: user.id,
          handle: user.handle,
          name: user.name,
          photoUrl: user.photo_url,
        },
        createdAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error posting comment:', error)
    throw error
  }
}

async function handleGetComments(
  req: VercelRequest,
  res: VercelResponse,
  videoId: string,
  pool: any
) {
  try {
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const result = await pool.query(`
      SELECT
        vc.id,
        COALESCE(vc.body, vc.content) as body,
        vc.created_at,
        u.id as user_id,
        u.handle,
        u.name,
        u.photo_url
      FROM video_comments vc
      LEFT JOIN users u ON vc.user_id = u.id
      WHERE vc.video_id = $1
      ORDER BY vc.created_at DESC
      LIMIT $2 OFFSET $3
    `, [videoId, limit, offset])

    const comments = result.rows.map((row: any) => ({
      id: row.id,
      body: row.body,
      user: {
        id: row.user_id,
        handle: row.handle,
        name: row.name,
        photoUrl: row.photo_url,
      },
      createdAt: row.created_at,
    }))

    res.json({ comments })
  } catch (error) {
    console.error('Error fetching comments:', error)
    throw error
  }
}

export default compose(cors, errorHandler)(handler)
