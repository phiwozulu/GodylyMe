import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const userId = (req as any).userId
  const limit = parseInt(req.query.limit as string) || 10
  const pool = getPgPool()

  try {
    // Get suggested connections based on mutual follows
    // Users that your friends follow, but you don't follow yet
    const result = await pool.query(`
      WITH my_following AS (
        SELECT following_id
        FROM user_follows
        WHERE follower_id = $1
      ),
      friends_following AS (
        SELECT DISTINCT uf2.following_id, COUNT(*) as mutual_count
        FROM user_follows uf1
        INNER JOIN user_follows uf2 ON uf1.following_id = uf2.follower_id
        WHERE uf1.follower_id = $1
          AND uf2.following_id != $1
          AND uf2.following_id NOT IN (SELECT following_id FROM my_following)
        GROUP BY uf2.following_id
      )
      SELECT
        u.id,
        u.handle,
        u.name,
        u.photo_url,
        u.church,
        u.country,
        ff.mutual_count as mutual_connections
      FROM friends_following ff
      INNER JOIN users u ON ff.following_id = u.id
      ORDER BY ff.mutual_count DESC, u.created_at DESC
      LIMIT $2
    `, [userId, limit])

    const suggestions = result.rows.map(row => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      photoUrl: row.photo_url,
      church: row.church,
      country: row.country,
      mutualConnections: parseInt(row.mutual_connections) || 0,
      summary: row.church ? `From ${row.church}` : null,
    }))

    res.json({ suggestions })
  } catch (error) {
    console.error('Error fetching connection suggestions:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
