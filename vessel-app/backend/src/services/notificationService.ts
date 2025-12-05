import { Pool } from 'pg'
import { getPgPool } from '../clients'
import { DbUser, mapRow } from './userService'

const pool: Pool = getPgPool()

export type NotificationType = 'follow' | 'like' | 'comment'

export type NotificationRecord = {
  id: string
  recipient_id: string
  type: NotificationType
  video_id: string | null
  video_title: string | null
  comment_preview: string | null
  created_at: Date
  actor: DbUser
}

type InsertNotificationInput = {
  recipientId: string
  actorId: string
  type: NotificationType
  videoId?: string | null
  videoTitle?: string | null
  commentPreview?: string | null
}

type NotificationQueryRow = {
  id: string
  type: NotificationType
  video_id: string | null
  video_title: string | null
  comment_preview: string | null
  created_at: Date
  actor_json: DbUser
}

export async function ensureNotificationTables(): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('follow', 'like', 'comment')),
      video_id TEXT,
      video_title TEXT,
      comment_preview TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx ON notifications(recipient_id, created_at DESC);')
}

export async function recordNotification(input: InsertNotificationInput): Promise<void> {
  if (!input.recipientId || !input.actorId || input.recipientId === input.actorId) {
    return
  }
  await pool.query(
    `
      INSERT INTO notifications (recipient_id, actor_id, type, video_id, video_title, comment_preview)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      input.recipientId,
      input.actorId,
      input.type,
      input.videoId ?? null,
      input.videoTitle ?? null,
      input.commentPreview ?? null,
    ]
  )
}

export async function listNotifications(recipientId: string, limit = 50): Promise<NotificationRecord[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 100)
  const result = await pool.query<NotificationQueryRow>(
    `
      SELECT
        n.id,
        n.type,
        n.video_id,
        n.video_title,
        n.comment_preview,
        n.created_at,
        row_to_json(actor) AS actor_json
      FROM notifications n
      JOIN users actor ON actor.id = n.actor_id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2
    `,
    [recipientId, cappedLimit]
  )

  return result.rows.map((row) => ({
    id: row.id,
    recipient_id: recipientId,
    type: row.type,
    video_id: row.video_id,
    video_title: row.video_title,
    comment_preview: row.comment_preview,
    created_at: row.created_at,
    actor: mapRow(row.actor_json),
  }))
}

export async function dismissNotification(notificationId: string, userId: string): Promise<void> {
  await pool.query(
    'DELETE FROM notifications WHERE id = $1 AND recipient_id = $2',
    [notificationId, userId]
  )
}
