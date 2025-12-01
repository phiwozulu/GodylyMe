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

  if (req.method === 'POST') {
    return handlePostComment(req, res, id as string, userId, pool)
  } else if (req.method === 'GET') {
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

    // Insert comment
    const commentId = `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    await pool.query(`
      INSERT INTO video_comments (id, video_id, user_id, content, created_at)
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
        content: content.trim(),
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
        vc.content,
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

    const comments = result.rows.map(row => ({
      id: row.id,
      content: row.content,
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

export default compose(cors, errorHandler, requireAuth)(handler)
