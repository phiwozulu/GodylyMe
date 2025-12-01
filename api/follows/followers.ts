import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    // Get list of users that follow the current user
    const result = await pool.query(`
      SELECT
        u.id,
        u.handle,
        u.name,
        u.photo_url,
        u.church,
        u.country
      FROM users u
      INNER JOIN user_follows uf ON u.id = uf.follower_id
      WHERE uf.following_id = $1
      ORDER BY u.name
    `, [userId])

    const followers = result.rows.map(row => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      photoUrl: row.photo_url,
      church: row.church,
      country: row.country,
    }))

    res.json({ followers })
  } catch (error) {
    console.error('Error fetching followers list:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
