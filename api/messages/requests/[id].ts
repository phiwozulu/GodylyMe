import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, requireAuth, validateBody } from '../../_lib/serverless'
import { getPgPool } from '../../_lib/clients'
import { initDatabase } from '../../_lib/initDatabase'

const actionSchema = z.object({
  action: z.enum(['accept', 'decline']),
})

async function handler(req: VercelRequest, res: VercelResponse, payload: z.infer<typeof actionSchema>) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()
  const requestId = req.query.id as string

  if (!requestId) {
    return res.status(400).json({ message: 'Request ID is required' })
  }

  try {
    // Fetch the request
    const requestResult = await pool.query(
      'SELECT * FROM message_requests WHERE id = $1',
      [requestId]
    )

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Message request not found' })
    }

    const request = requestResult.rows[0]

    // Verify user is the recipient
    if (request.recipient_id !== userId) {
      return res.status(403).json({ message: 'You can only respond to requests sent to you' })
    }

    // Verify request is still pending
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been responded to' })
    }

    if (payload.action === 'accept') {
      // Create a new message thread
      const threadResult = await pool.query(
        'INSERT INTO message_threads (created_at, updated_at) VALUES (NOW(), NOW()) RETURNING id'
      )
      const threadId = threadResult.rows[0].id

      // Add both users as participants
      await pool.query(
        'INSERT INTO thread_participants (thread_id, user_id) VALUES ($1, $2), ($1, $3)',
        [threadId, request.sender_id, request.recipient_id]
      )

      // Insert the initial message from the request
      await pool.query(`
        INSERT INTO messages (thread_id, sender_id, content, created_at)
        VALUES ($1, $2, $3, $4)
      `, [threadId, request.sender_id, request.content, request.created_at])

      // Update request status to accepted
      await pool.query(
        'UPDATE message_requests SET status = $1, updated_at = NOW() WHERE id = $2',
        ['accepted', requestId]
      )

      // Fetch the thread with participants
      const threadInfoResult = await pool.query(`
        SELECT
          mt.id as thread_id,
          mt.created_at as thread_created_at,
          mt.updated_at as thread_updated_at,
          tp.user_id as participant_user_id,
          u.handle as participant_handle,
          u.name as participant_name,
          u.photo_url as participant_photo_url,
          m.id as last_message_id,
          m.content as last_message_content,
          m.created_at as last_message_created_at,
          m.sender_id as last_sender_id
        FROM message_threads mt
        INNER JOIN thread_participants tp ON mt.id = tp.thread_id AND tp.user_id != $2
        LEFT JOIN users u ON tp.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT id, content, created_at, sender_id
          FROM messages
          WHERE thread_id = mt.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON TRUE
        WHERE mt.id = $1
      `, [threadId, userId])

      const thread = {
        id: threadId,
        participants: threadInfoResult.rows.map(row => ({
          id: row.participant_user_id,
          handle: row.participant_handle,
          name: row.participant_name,
          photoUrl: row.participant_photo_url,
        })),
        lastMessage: threadInfoResult.rows[0] ? {
          id: threadInfoResult.rows[0].last_message_id,
          body: threadInfoResult.rows[0].last_message_content,
          createdAt: threadInfoResult.rows[0].last_message_created_at,
          sender: {
            id: threadInfoResult.rows[0].last_sender_id,
          },
        } : null,
        unreadCount: 0,
        createdAt: threadInfoResult.rows[0]?.thread_created_at,
        updatedAt: threadInfoResult.rows[0]?.thread_updated_at,
      }

      return res.json({
        status: 'accepted',
        thread,
      })
    } else if (payload.action === 'decline') {
      // Update request status to declined
      await pool.query(
        'UPDATE message_requests SET status = $1, updated_at = NOW() WHERE id = $2',
        ['declined', requestId]
      )

      return res.json({ status: 'declined' })
    }

    return res.status(400).json({ message: 'Invalid action' })
  } catch (error) {
    console.error('Error responding to message request:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth, validateBody(actionSchema))(handler)
