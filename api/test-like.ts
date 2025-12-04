import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const pool = getPgPool()
  const results: any = {}

  try {
    // 1. Check if video_likes table exists and its schema
    results.step1 = 'Checking video_likes table schema...'
    const tableCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_likes'
      ORDER BY ordinal_position
    `)
    results.video_likes_schema = tableCheck.rows
    results.video_likes_exists = tableCheck.rows.length > 0

    // 2. Get a sample video
    results.step2 = 'Getting sample video...'
    const videoResult = await pool.query('SELECT id, user_id FROM videos LIMIT 1')
    if (videoResult.rows.length === 0) {
      results.error = 'No videos in database'
      return res.json(results)
    }
    const sampleVideo = videoResult.rows[0]
    results.sample_video = {
      id: sampleVideo.id,
      id_type: typeof sampleVideo.id,
      user_id: sampleVideo.user_id
    }

    // 3. Try to insert a test like
    results.step3 = 'Testing like insertion...'
    try {
      await pool.query(`
        INSERT INTO video_likes (video_id, user_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (video_id, user_id) DO NOTHING
      `, [sampleVideo.id, sampleVideo.user_id])
      results.like_insert = 'SUCCESS'
    } catch (err) {
      results.like_insert_error = {
        message: err instanceof Error ? err.message : String(err),
        code: (err as any).code,
        detail: (err as any).detail
      }
    }

    // 4. Try to count likes
    results.step4 = 'Testing like count...'
    try {
      const countResult = await pool.query(
        'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
        [sampleVideo.id]
      )
      results.like_count = countResult.rows[0].count
    } catch (err) {
      results.count_error = err instanceof Error ? err.message : String(err)
    }

    // 5. Check if table needs to be recreated
    const videoIdType = tableCheck.rows.find(r => r.column_name === 'video_id')?.data_type
    results.video_id_column_type = videoIdType
    results.needs_recreation = videoIdType === 'uuid'

    return res.json(results)

  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      results
    })
  }
}
