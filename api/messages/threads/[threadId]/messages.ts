import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../../../_lib/serverless'
import { getPgPool } from '../../../_lib/clients'
import { initDatabase } from '../../../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const { threadId } = req.query
  const pool = getPgPool()

  if (!threadId || typeof threadId !== 'string') {
    return res.status(400).json({ message: 'Thread ID parameter is required' })
  }

  try {
    // Verify user is participant in thread
    const participantCheck = await pool.query(`
      SELECT 1 FROM thread_participants
      WHERE thread_id = $1 AND user_id = $2
    `, [threadId, userId])

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Not authorized to access this thread' })
    }

    if (req.method === 'GET') {
      return handleGetMessages(req, res, threadId, pool)
    } else if (req.method === 'POST') {
      return handlePostMessage(req, res, threadId, userId, pool)
    } else {
      return res.status(405).json({ message: 'Method not allowed' })
    }
  } catch (error) {
    console.error('Error handling thread messages:', error)
    throw error
  }
}

async function handleGetMessages(
  req: VercelRequest,
  res: VercelResponse,
  threadId: string,
  pool: any
) {
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0

  const result = await pool.query(`
    SELECT
      m.id,
      m.content,
      m.created_at,
      u.id as sender_id,
      u.handle as sender_handle,
      u.name as sender_name,
      u.photo_url as sender_photo_url
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.thread_id = $1
    ORDER BY m.created_at DESC
    LIMIT $2 OFFSET $3
  `, [threadId, limit, offset])

  const messages = result.rows.map((row: any) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
    sender: {
      id: row.sender_id,
      handle: row.sender_handle,
      name: row.sender_name,
      photoUrl: row.sender_photo_url,
    },
  }))

  res.json({ messages })
}

async function handlePostMessage(
  req: VercelRequest,
  res: VercelResponse,
  threadId: string,
  userId: string,
  pool: any
) {
  // Accept both 'body' and 'content' for backward compatibility
  const { body, content } = req.body
  const messageContent = body || content

  if (!messageContent || !messageContent.trim()) {
    return res.status(400).json({ message: 'Message content is required' })
  }

  // Insert message (insert into both content and body for backward compatibility)
  const result = await pool.query(`
    INSERT INTO messages (thread_id, sender_id, content, body, created_at)
    VALUES ($1, $2, $3, $3, NOW())
    RETURNING id, thread_id, sender_id, content, created_at
  `, [threadId, userId, messageContent.trim()])

  const message = result.rows[0]

  // Update thread timestamp
  await pool.query(`
    UPDATE message_threads
    SET updated_at = NOW()
    WHERE id = $1
  `, [threadId])

  // Get sender info
  const userResult = await pool.query(
    'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
    [userId]
  )

  const user = userResult.rows[0]

  res.json({
    message: {
      id: message.id,
      content: message.content,
      createdAt: message.created_at,
      sender: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        photoUrl: user.photo_url,
      },
    },
  })
}

export default compose(cors, errorHandler, requireAuth)(handler)
