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

    // Determine the correct "followed user" column (was renamed from followee_id -> following_id)
    const columnCheck = await pool.query(
      `
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'user_follows' AND column_name = 'following_id'
        ) AS has_following
      `
    )
    const followedColumn = columnCheck.rows[0]?.has_following ? 'following_id' : 'followee_id'

    const followersResult = await pool.query(
      `SELECT COUNT(*) AS count FROM user_follows WHERE ${followedColumn} = $1`,
      [userId]
    )

    const followingResult = await pool.query(
      `SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = $1`,
      [userId]
    )

    // Get video count
    const videosResult = await pool.query(
      'SELECT COUNT(*) as count FROM videos WHERE user_id = $1',
      [userId]
    )

    res.json({
      followers: parseInt(followersResult.rows[0].count) || 0,
      following: parseInt(followingResult.rows[0].count) || 0,
      videos: parseInt(videosResult.rows[0].count) || 0,
    })
  } catch (error) {
    console.error('Error fetching profile stats:', error)
    throw error
  }
}

export default compose(cors, errorHandler)(handler)
