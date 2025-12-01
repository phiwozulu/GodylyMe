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
    // Find user by handle or ID
    const userResult = await pool.query(
      'SELECT id FROM users WHERE handle = $1 OR id = $1',
      [identifier.toLowerCase()]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const userId = userResult.rows[0].id

    // Get follower count
    const followersResult = await pool.query(
      'SELECT COUNT(*) as count FROM user_follows WHERE following_id = $1',
      [userId]
    )

    // Get following count
    const followingResult = await pool.query(
      'SELECT COUNT(*) as count FROM user_follows WHERE follower_id = $1',
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
