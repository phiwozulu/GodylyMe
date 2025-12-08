import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler } from '../../../_lib/serverless'
import { getPgPool } from '../../../_lib/clients'
import { initDatabase } from '../../../_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  const { identifier } = req.query
  const pool = getPgPool()

  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ message: 'Identifier parameter is required' })
  }

  try {
    // Normalize handle/ID (strip @, lower-case) so we can match by handle or UUID
    const normalizedIdentifier = identifier.trim().replace(/^@/, '').toLowerCase()

    // Find user by handle or ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE handle = $1 OR id = $1',
      [normalizedIdentifier]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const userId = userResult.rows[0].id
    console.log(`[STATS] User ID: ${userId}`)

    // First, check what columns exist in user_follows table
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'user_follows'
      ORDER BY ordinal_position
    `)
    console.log(`[STATS] user_follows columns:`, columnsResult.rows.map(r => r.column_name))

    // Get actual follow records for this user
    const sampleFollows = await pool.query(`
      SELECT * FROM user_follows LIMIT 5
    `)
    console.log(`[STATS] Sample follow records:`, sampleFollows.rows)

    // Try to count with both possible column names
    let followersCount = 0
    let followingCount = 0

    // Try following_id first
    try {
      const result1 = await pool.query(
        `SELECT COUNT(*) AS count FROM user_follows WHERE following_id = $1`,
        [userId]
      )
      followersCount = parseInt(result1.rows[0].count) || 0
      console.log(`[STATS] Followers count (following_id): ${followersCount}`)
    } catch (err) {
      console.log(`[STATS] following_id column doesn't exist, trying followee_id`)
      // Try followee_id as fallback
      const result2 = await pool.query(
        `SELECT COUNT(*) AS count FROM user_follows WHERE followee_id = $1`,
        [userId]
      )
      followersCount = parseInt(result2.rows[0].count) || 0
      console.log(`[STATS] Followers count (followee_id): ${followersCount}`)
    }

    // Count following
    const followingResult = await pool.query(
      `SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = $1`,
      [userId]
    )
    followingCount = parseInt(followingResult.rows[0].count) || 0
    console.log(`[STATS] Following count: ${followingCount}`)

    // Get video count
    const videosResult = await pool.query(
      'SELECT COUNT(*) as count FROM videos WHERE user_id = $1',
      [userId]
    )
    const videosCount = parseInt(videosResult.rows[0].count) || 0
    console.log(`[STATS] Videos count: ${videosCount}`)

    const stats = {
      followers: followersCount,
      following: followingCount,
      videos: videosCount,
    }
    console.log(`[STATS] Final response:`, stats)

    res.json(stats)
  } catch (error) {
    console.error('Error fetching profile stats:', error)
    throw error
  }
}

export default compose(cors, errorHandler)(handler)
