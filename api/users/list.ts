import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const pool = getPgPool()

  try {
    // Get all users with basic info
    const result = await pool.query(`
      SELECT
        id,
        handle,
        name,
        email,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 100
    `)

    const users = result.rows.map(row => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
    }))

    res.json({ users, count: users.length })
  } catch (error) {
    console.error('Error listing users:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
