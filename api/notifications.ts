import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from './_lib/serverless'
import { getPgPool } from './_lib/clients'
import { initDatabase } from './_lib/initDatabase'

interface DbNotification {
  id: string
  type: string
  actor_id: string
  actor_handle: string
  actor_name: string
  actor_photo_url: string | null
  target_id: string | null
  is_read: boolean
  created_at: string
  video_title?: string | null
  comment_content?: string | null
}

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Fetch notifications for the user
    const result = await pool.query<DbNotification>(`
      SELECT
        n.id,
        n.type,
        n.actor_id,
        u.handle as actor_handle,
        u.name as actor_name,
        u.photo_url as actor_photo_url,
        n.target_id,
        n.is_read,
        n.created_at,
        v.title as video_title,
        vc.content as comment_content
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      LEFT JOIN videos v ON n.target_id = v.id AND n.type IN ('like', 'comment')
      LEFT JOIN video_comments vc ON n.target_id = vc.id AND n.type = 'comment'
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [userId])

    const notifications = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      actor: {
        id: row.actor_id,
        handle: row.actor_handle,
        name: row.actor_name,
        photoUrl: row.actor_photo_url,
      },
      targetId: row.target_id,
      videoTitle: row.video_title,
      commentPreview: row.comment_content ? row.comment_content.substring(0, 100) : null,
      isRead: row.is_read,
      createdAt: row.created_at,
    }))

    res.json({ notifications })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
