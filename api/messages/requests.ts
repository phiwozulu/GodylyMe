import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { compose, cors, errorHandler, requireAuth, validateBody } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

const actionSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['accept', 'decline']),
})

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    if (req.method === 'GET') {
      // Fetch all message requests (both sent and received)
      const result = await pool.query(`
        SELECT
          mr.id,
          mr.sender_id,
          mr.recipient_id,
          mr.content,
          mr.status,
          mr.created_at,
          mr.updated_at,
          u_sender.id as sender_id,
          u_sender.handle as sender_handle,
          u_sender.name as sender_name,
          u_sender.photo_url as sender_photo_url,
          u_recipient.id as recipient_id,
          u_recipient.handle as recipient_handle,
          u_recipient.name as recipient_name,
          u_recipient.photo_url as recipient_photo_url
        FROM message_requests mr
        LEFT JOIN users u_sender ON mr.sender_id = u_sender.id
        LEFT JOIN users u_recipient ON mr.recipient_id = u_recipient.id
        WHERE mr.sender_id = $1 OR mr.recipient_id = $1
        ORDER BY mr.created_at DESC
      `, [userId])

      const requests = result.rows.map(row => ({
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        content: row.content,
        status: row.status,
        direction: row.sender_id === userId ? 'outbound' : 'inbound',
        sender: {
          id: row.sender_id,
          handle: row.sender_handle,
          name: row.sender_name,
          photoUrl: row.sender_photo_url,
        },
        recipient: {
          id: row.recipient_id,
          handle: row.recipient_handle,
          name: row.recipient_name,
          photoUrl: row.recipient_photo_url,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      return res.json({ requests })
    }

    if (req.method === 'POST') {
      // Send a new message request
      const sendSchema = z.object({
        recipientHandle: z.string(),
        content: z.string().min(1).max(10000),
      })

      const payload = sendSchema.parse(req.body)

      // Find recipient by handle
      const recipientResult = await pool.query(
        'SELECT id FROM users WHERE handle = $1',
        [payload.recipientHandle.toLowerCase()]
      )

      if (recipientResult.rows.length === 0) {
        return res.status(404).json({ message: 'Recipient not found' })
      }

      const recipientId = recipientResult.rows[0].id

      // Check if request already exists
      const existingRequest = await pool.query(
        'SELECT id, status FROM message_requests WHERE sender_id = $1 AND recipient_id = $2',
        [userId, recipientId]
      )

      if (existingRequest.rows.length > 0) {
        const existing = existingRequest.rows[0]
        if (existing.status === 'pending') {
          return res.status(400).json({ message: 'You already have a pending request with this user' })
        }
        if (existing.status === 'declined') {
          return res.status(400).json({ message: 'This user has declined your previous request' })
        }
      }

      // Check if they're already friends (mutual follow)
      const mutualCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM user_followers uf1
        INNER JOIN user_followers uf2 ON uf1.follower_id = uf2.followed_id AND uf1.followed_id = uf2.follower_id
        WHERE uf1.follower_id = $1 AND uf1.followed_id = $2
      `, [userId, recipientId])

      const isMutual = parseInt(mutualCheck.rows[0]?.count || '0') > 0

      if (isMutual) {
        // They're friends, create thread directly instead of request
        return res.status(400).json({ message: 'You can message this user directly' })
      }

      // Create message request
      const requestResult = await pool.query(`
        INSERT INTO message_requests (sender_id, recipient_id, content, status, created_at, updated_at)
        VALUES ($1, $2, $3, 'pending', NOW(), NOW())
        RETURNING id, sender_id, recipient_id, content, status, created_at, updated_at
      `, [userId, recipientId, payload.content])

      const request = requestResult.rows[0]

      // Get full user info
      const senderResult = await pool.query(
        'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
        [userId]
      )

      const recipientUserResult = await pool.query(
        'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
        [recipientId]
      )

      const sender = senderResult.rows[0]
      const recipientUser = recipientUserResult.rows[0]

      return res.json({
        request: {
          id: request.id,
          senderId: request.sender_id,
          recipientId: request.recipient_id,
          content: request.content,
          status: request.status,
          direction: 'outbound',
          sender: {
            id: sender.id,
            handle: sender.handle,
            name: sender.name,
            photoUrl: sender.photo_url,
          },
          recipient: {
            id: recipientUser.id,
            handle: recipientUser.handle,
            name: recipientUser.name,
            photoUrl: recipientUser.photo_url,
          },
          createdAt: request.created_at,
          updatedAt: request.updated_at,
        },
      })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (error) {
    console.error('Error handling message requests:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
