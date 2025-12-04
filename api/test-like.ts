import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pool = getPgPool()
  const results: string[] = []

  try {
    results.push('=== LIKE FUNCTIONALITY TEST ===\n')

    // 1. Check if video_likes table exists and its schema
    results.push('STEP 1: Checking video_likes table schema...')
    const tableCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'video_likes'
      ORDER BY ordinal_position
    `)

    if (tableCheck.rows.length === 0) {
      results.push('❌ video_likes table DOES NOT EXIST')
    } else {
      results.push('✓ video_likes table EXISTS')
      results.push('Schema:')
      tableCheck.rows.forEach(row => {
        results.push(`  - ${row.column_name}: ${row.data_type}`)
      })

      const videoIdType = tableCheck.rows.find(r => r.column_name === 'video_id')?.data_type
      if (videoIdType === 'uuid') {
        results.push('❌ PROBLEM FOUND: video_id is UUID (should be TEXT)')
      } else if (videoIdType === 'text') {
        results.push('✓ video_id is TEXT (correct)')
      }
    }

    // 2. Get a sample video
    results.push('\nSTEP 2: Getting sample video...')
    const videoResult = await pool.query('SELECT id, user_id FROM videos LIMIT 1')
    if (videoResult.rows.length === 0) {
      results.push('❌ No videos in database')
      return res.setHeader('Content-Type', 'text/plain').send(results.join('\n'))
    }
    const sampleVideo = videoResult.rows[0]
    results.push(`✓ Found video: ${sampleVideo.id} (type: ${typeof sampleVideo.id})`)

    // 3. Try to insert a test like
    results.push('\nSTEP 3: Testing like insertion...')
    try {
      await pool.query(`
        INSERT INTO video_likes (video_id, user_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (video_id, user_id) DO NOTHING
      `, [sampleVideo.id, sampleVideo.user_id])
      results.push('✓ Like inserted successfully')
    } catch (err: any) {
      results.push('❌ Like insertion FAILED')
      results.push(`Error: ${err.message}`)
      if (err.code) results.push(`Code: ${err.code}`)
      if (err.detail) results.push(`Detail: ${err.detail}`)
    }

    // 4. Try to count likes
    results.push('\nSTEP 4: Testing like count...')
    try {
      const countResult = await pool.query(
        'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
        [sampleVideo.id]
      )
      results.push(`✓ Like count: ${countResult.rows[0].count}`)
    } catch (err: any) {
      results.push(`❌ Count failed: ${err.message}`)
    }

    results.push('\n=== TEST COMPLETE ===')

    return res.setHeader('Content-Type', 'text/plain').send(results.join('\n'))

  } catch (error: any) {
    results.push('\n❌ FATAL ERROR')
    results.push(`Error: ${error.message}`)
    if (error.stack) results.push(`\nStack:\n${error.stack}`)
    return res.status(500).setHeader('Content-Type', 'text/plain').send(results.join('\n'))
  }
}
