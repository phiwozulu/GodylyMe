import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

interface DbThread {
  thread_id: string
  thread_created_at: string
  thread_updated_at: string
  last_message_id: string | null
  last_message_content: string | null
  last_message_created_at: string | null
  last_sender_id: string | null
  participant_user_id: string
  participant_handle: string
  participant_name: string
  participant_photo_url: string | null
}

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Handle POST request to create new thread
    if (req.method === 'POST') {
      const { handles, message, subject } = req.body

      if (!Array.isArray(handles) || handles.length === 0) {
        return res.status(400).json({ message: 'At least one recipient handle is required' })
      }

      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message content is required' })
      }

      // Find recipient by handle
      const recipientHandle = handles[0].toLowerCase()
      const recipientResult = await pool.query(
        'SELECT id FROM users WHERE handle = $1',
        [recipientHandle]
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

      let threadId: string

      if (existingThreadResult.rows.length > 0) {
        // Use existing thread
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

      // Insert the first message
      await pool.query(`
        INSERT INTO messages (thread_id, sender_id, content, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [threadId, userId, message.trim()])

      // Update thread timestamp
      await pool.query(
        'UPDATE message_threads SET updated_at = NOW() WHERE id = $1',
        [threadId]
      )

      // Fetch the complete thread with participants
      const threadResult = await pool.query(`
        SELECT
          mt.id as thread_id,
          mt.created_at as thread_created_at,
          mt.updated_at as thread_updated_at,
          m.id as last_message_id,
          m.content as last_message_content,
          m.created_at as last_message_created_at,
          m.sender_id as last_sender_id,
          tp.user_id as participant_user_id,
          u.handle as participant_handle,
          u.name as participant_name,
          u.photo_url as participant_photo_url
        FROM message_threads mt
        INNER JOIN thread_participants tp ON mt.id = tp.thread_id AND tp.user_id != $1
        LEFT JOIN users u ON tp.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT id, content, created_at, sender_id
          FROM messages
          WHERE thread_id = mt.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON TRUE
        WHERE mt.id = $2
      `, [userId, threadId])

      const thread = {
        id: threadId,
        participants: threadResult.rows.map(row => ({
          id: row.participant_user_id,
          handle: row.participant_handle,
          name: row.participant_name,
          photoUrl: row.participant_photo_url,
        })),
        lastMessage: threadResult.rows[0] && threadResult.rows[0].last_message_id ? {
          id: threadResult.rows[0].last_message_id,
          body: threadResult.rows[0].last_message_content,
          createdAt: threadResult.rows[0].last_message_created_at,
          sender: {
            id: threadResult.rows[0].last_sender_id,
          },
        } : null,
        unreadCount: 0,
        createdAt: threadResult.rows[0]?.thread_created_at,
        updatedAt: threadResult.rows[0]?.thread_updated_at,
      }

      return res.json({ thread })
    }

    // Handle GET request to fetch message threads
    // Fetch message threads for the user
    const result = await pool.query<DbThread>(`
      WITH user_threads AS (
        SELECT DISTINCT thread_id
        FROM thread_participants
        WHERE user_id = $1
      ),
      thread_info AS (
        SELECT
          mt.id as thread_id,
          mt.created_at as thread_created_at,
          mt.updated_at as thread_updated_at,
          m.id as last_message_id,
          m.content as last_message_content,
          m.created_at as last_message_created_at,
          m.sender_id as last_sender_id
        FROM message_threads mt
        INNER JOIN user_threads ut ON mt.id = ut.thread_id
        LEFT JOIN LATERAL (
          SELECT id, content, created_at, sender_id
          FROM messages
          WHERE thread_id = mt.id
          ORDER BY created_at DESC
          LIMIT 1
        ) m ON TRUE
      )
      SELECT
        ti.*,
        tp.user_id as participant_user_id,
        u.handle as participant_handle,
        u.name as participant_name,
        u.photo_url as participant_photo_url
      FROM thread_info ti
      INNER JOIN thread_participants tp ON ti.thread_id = tp.thread_id AND tp.user_id != $1
      LEFT JOIN users u ON tp.user_id = u.id
      ORDER BY ti.thread_updated_at DESC
    `, [userId])

    // Group threads by thread_id
    const threadsMap = new Map<string, any>()

    result.rows.forEach(row => {
      if (!threadsMap.has(row.thread_id)) {
        threadsMap.set(row.thread_id, {
          id: row.thread_id,
          participants: [],
          lastMessage: row.last_message_id ? {
            id: row.last_message_id,
            body: row.last_message_content,
            createdAt: row.last_message_created_at,
            sender: {
              id: row.last_sender_id,
            },
          } : null,
          unreadCount: 0, // TODO: implement unread count tracking
          createdAt: row.thread_created_at,
          updatedAt: row.thread_updated_at,
        })
      }

      // Add participant
      if (row.participant_user_id) {
        threadsMap.get(row.thread_id).participants.push({
          id: row.participant_user_id,
          handle: row.participant_handle,
          name: row.participant_name,
          photoUrl: row.participant_photo_url,
        })
      }
    })

    const threads = Array.from(threadsMap.values())

    res.json({ threads })
  } catch (error) {
    console.error('Error fetching message threads:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
