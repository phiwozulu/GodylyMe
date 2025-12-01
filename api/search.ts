import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler } from './_lib/serverless'
import { getPgPool } from './_lib/clients'
import { initDatabase } from './_lib/initDatabase'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const pool = getPgPool()
  const { q, limit = 10 } = req.body

  if (!q || typeof q !== 'string' || !q.trim()) {
    return res.json({ accounts: [], videos: [], categories: [] })
  }

  // Normalize search term - remove @ prefix if present
  const normalizedTerm = q.trim().startsWith('@')
    ? q.trim().slice(1).toLowerCase()
    : q.trim().toLowerCase()

  console.log('Search query:', { original: q, normalized: normalizedTerm })

  try {
    // Search users - search by name, handle, or email
    const userResults = await pool.query(`
      SELECT
        id,
        handle,
        name,
        photo_url,
        church,
        country
      FROM users
      WHERE
        LOWER(COALESCE(name, '')) LIKE $1 OR
        LOWER(COALESCE(handle, '')) LIKE $1 OR
        LOWER(COALESCE(email, '')) LIKE $1 OR
        id = $2
      LIMIT $3
    `, [`%${normalizedTerm}%`, normalizedTerm, limit])

    console.log('User search results:', userResults.rows.length, 'users found')
    if (userResults.rows.length > 0) {
      console.log('First user found:', userResults.rows[0])
    }

    const users = userResults.rows.map(row => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      photoUrl: row.photo_url,
      church: row.church,
      country: row.country,
    }))

    // Search videos
    const videoResults = await pool.query(`
      SELECT
        v.id,
        v.title,
        v.description,
        v.video_url,
        v.thumbnail_url,
        v.duration_seconds,
        v.created_at,
        u.id as user_id,
        u.handle,
        u.name,
        u.photo_url
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      WHERE
        LOWER(v.title) LIKE $1 OR
        LOWER(v.description) LIKE $1
      LIMIT $2
    `, [`%${normalizedTerm}%`, limit])

    const videos = videoResults.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      videoUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url,
      duration: row.duration_seconds,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        handle: row.handle,
        name: row.name,
        photoUrl: row.photo_url,
      },
    }))

    res.json({ accounts: users, videos, categories: [] })
  } catch (error) {
    console.error('Error searching:', error)
    throw error
  }
}

export default compose(cors, errorHandler)(handler)
