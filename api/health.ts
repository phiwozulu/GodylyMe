import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'
import { initDatabase } from './_lib/initDatabase'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[HEALTH] Starting health check...')

    // Initialize database
    await initDatabase()
    console.log('[HEALTH] Database initialized')

    const pool = getPgPool()

    // Check if video_likes table exists and its schema
    const likesTableInfo = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_likes'
      ORDER BY ordinal_position;
    `)

    // Check if video_comments table exists and its schema
    const commentsTableInfo = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_comments'
      ORDER BY ordinal_position;
    `)

    // Check if video_shares table exists and its schema
    const sharesTableInfo = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_shares'
      ORDER BY ordinal_position;
    `)

    // Get a sample video ID to test with
    const videoSample = await pool.query('SELECT id FROM videos LIMIT 1')

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        tables: {
          video_likes: likesTableInfo.rows.length > 0 ? {
            exists: true,
            columns: likesTableInfo.rows
          } : { exists: false },
          video_comments: commentsTableInfo.rows.length > 0 ? {
            exists: true,
            columns: commentsTableInfo.rows
          } : { exists: false },
          video_shares: sharesTableInfo.rows.length > 0 ? {
            exists: true,
            columns: sharesTableInfo.rows
          } : { exists: false }
        },
        sampleVideoId: videoSample.rows[0]?.id || null
      }
    })
  } catch (error) {
    console.error('[HEALTH] Error:', error)
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
