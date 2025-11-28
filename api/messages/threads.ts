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
