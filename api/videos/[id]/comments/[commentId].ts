import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from '../../../_lib/clients'
import * as jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return secret
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { id: videoId, commentId } = req.query
  if (!videoId || typeof videoId !== 'string') {
    return res.status(400).json({ message: 'Video ID required' })
  }
  if (!commentId || typeof commentId !== 'string') {
    return res.status(400).json({ message: 'Comment ID required' })
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
    // Get comment details and video owner
    const commentCheck = await pool.query(
      `SELECT c.user_id as comment_author, v.user_id as video_owner
       FROM video_comments c
       JOIN videos v ON c.video_id = v.id
       WHERE c.id = $1 AND c.video_id = $2`,
      [commentId, videoId]
    )

    if (commentCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' })
    }

    const { comment_author, video_owner } = commentCheck.rows[0]

    // Check if user is authorized (comment author or video owner)
    if (userId !== comment_author && userId !== video_owner) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' })
    }

    // Delete the comment
    await pool.query(
      'DELETE FROM video_comments WHERE id = $1',
      [commentId]
    )

    return res.json({ message: 'Comment deleted successfully' })
  } catch (error: any) {
    console.error('[DELETE COMMENT] Error:', error)
    return res.status(500).json({
      message: error.message || 'Failed to delete comment',
      error: String(error)
    })
  }
}
