import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, requireAuth, validateBody } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

const sendMessageSchema = z.object({
  threadId: z.string().uuid().optional(),
  recipientHandle: z.string().optional(),
  content: z.string().min(1).max(10000),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof sendMessageSchema>) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    let threadId = payload.threadId

    // If no threadId, create a new thread with the recipient
    if (!threadId && payload.recipientHandle) {
      // Find recipient by handle
      const recipientResult = await pool.query(
        'SELECT id FROM users WHERE handle = $1',
        [payload.recipientHandle.toLowerCase()]
      )

      if (recipientResult.rows.length === 0) {
        return res.status(404).json({ message: 'Recipient not found' })
      }

      const recipientId = recipientResult.rows[0].id

      // Check if a thread already exists between these two users
      const existingThreadResult = await pool.query(`
        SELECT tp1.thread_id
        FROM thread_participants tp1
        INNER JOIN thread_participants tp2 ON tp1.thread_id = tp2.thread_id
        WHERE tp1.user_id = $1 AND tp2.user_id = $2
        LIMIT 1
      `, [userId, recipientId])

      if (existingThreadResult.rows.length > 0) {
        threadId = existingThreadResult.rows[0].thread_id
      } else {
        // Create new thread
        const newThreadResult = await pool.query(
          'INSERT INTO message_threads (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id'
        )
        threadId = newThreadResult.rows[0].id

        // Add participants
        await pool.query(
          'INSERT INTO thread_participants (thread_id, user_id) VALUES ($1, $2), ($1, $3)',
          [threadId, userId, recipientId]
        )
      }
    }

    if (!threadId) {
      return res.status(400).json({ message: 'Either threadId or recipientHandle is required' })
    }

    // Verify user is a participant in this thread
    const participantCheck = await pool.query(
      'SELECT 1 FROM thread_participants WHERE thread_id = $1 AND user_id = $2',
      [threadId, userId]
    )

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ message: 'You are not a participant in this thread' })
    }

    // Insert message (insert into both content and body for backward compatibility)
    const messageResult = await pool.query(`
      INSERT INTO messages (thread_id, sender_id, content, body, created_at)
      VALUES ($1, $2, $3, $3, NOW())
      RETURNING id, thread_id, sender_id, content, created_at
    `, [threadId, userId, payload.content])

    // Update thread updated_at
    await pool.query(
      'UPDATE message_threads SET updated_at = NOW() WHERE id = $1',
      [threadId]
    )

    const message = messageResult.rows[0]

    // Fetch sender info
    const senderResult = await pool.query(
      'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
      [userId]
    )

    const sender = senderResult.rows[0]

    res.json({
      message: {
        id: message.id,
        threadId: message.thread_id,
        body: message.content,
        sender: {
          id: sender.id,
          handle: sender.handle,
          name: sender.name,
          photoUrl: sender.photo_url,
        },
        createdAt: message.created_at,
      },
    })
  } catch (error) {
    console.error('Error sending message:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth, validateBody(sendMessageSchema))(handler)
