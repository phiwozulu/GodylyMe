import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const pool = getPgPool()
  const { hashes } = req.body

  if (!Array.isArray(hashes) || hashes.length === 0) {
    return res.json({ matches: [] })
  }

  try {
    // Find users with matching email hashes
    const result = await pool.query(`
      SELECT
        id,
        handle,
        name,
        photo_url,
        email_hash
      FROM users
      WHERE email_hash = ANY($1::text[])
    `, [hashes])

    const matches = result.rows.map(row => ({
      userId: row.id,
      handle: row.handle,
      name: row.name,
      photoUrl: row.photo_url,
      emailHash: row.email_hash,
    }))

    res.json({ matches })
  } catch (error) {
    console.error('Error matching contacts:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
