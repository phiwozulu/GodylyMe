import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'
import * as jwt from 'jsonwebtoken'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return secret
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const logs: string[] = []

  try {
    logs.push('=== LIKE ENDPOINT DEBUG ===\n')

    // 1. Check auth header
    logs.push('STEP 1: Checking authorization...')
    const authHeader = req.headers.authorization
    if (!authHeader) {
      logs.push('❌ No authorization header')
      return res.json({ logs, error: 'No auth header' })
    }
    if (!authHeader.startsWith('Bearer ')) {
      logs.push('❌ Authorization header does not start with Bearer')
      return res.json({ logs, error: 'Invalid auth format' })
    }
    logs.push('✓ Authorization header present')

    // 2. Verify JWT
    logs.push('\nSTEP 2: Verifying JWT...')
    let userId: string
    try {
      const token = authHeader.substring(7)
      logs.push(`Token length: ${token.length}`)
      const payload = jwt.verify(token, getJwtSecret()) as { sub: string }
      userId = payload.sub
      logs.push(`✓ JWT valid, user ID: ${userId}`)
    } catch (jwtError: any) {
      logs.push(`❌ JWT verification failed: ${jwtError.message}`)
      return res.json({ logs, error: 'JWT failed', details: jwtError.message })
    }

    // 3. Check video ID
    logs.push('\nSTEP 3: Checking video ID...')
    const videoId = req.body?.videoId || 'TEST_VIDEO_123'
    logs.push(`Video ID: ${videoId} (type: ${typeof videoId})`)

    // 4. Test database connection
    logs.push('\nSTEP 4: Testing database connection...')
    const pool = getPgPool()
    logs.push('✓ Pool obtained')

    // 5. Check table schema
    logs.push('\nSTEP 5: Checking table schema...')
    const schemaCheck = await pool.query(`
      SELECT column_name, data_type, table_name
      FROM information_schema.columns
      WHERE table_name = 'video_likes'
      ORDER BY ordinal_position
    `)

    if (schemaCheck.rows.length === 0) {
      logs.push('❌ Table does not exist')
    } else {
      logs.push('✓ Table exists with schema:')
      schemaCheck.rows.forEach(row => {
        logs.push(`  - ${row.column_name}: ${row.data_type}`)
      })

      const videoIdCol = schemaCheck.rows.find(r => r.column_name === 'video_id')
      if (videoIdCol?.data_type === 'uuid') {
        logs.push('❌ PROBLEM: video_id is UUID (should be TEXT)')
      } else if (videoIdCol?.data_type === 'text') {
        logs.push('✓ video_id is TEXT (correct)')
      }
    }

    // 6. Try insert
    logs.push('\nSTEP 6: Testing insert...')
    try {
      await pool.query(
        `INSERT INTO video_likes (video_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [videoId, userId]
      )
      logs.push('✓ Insert succeeded')
    } catch (insertError: any) {
      logs.push(`❌ Insert failed: ${insertError.message}`)
      logs.push(`Error code: ${insertError.code}`)
      logs.push(`Error detail: ${insertError.detail || 'none'}`)
      return res.json({
        logs,
        error: 'Insert failed',
        dbError: {
          message: insertError.message,
          code: insertError.code,
          detail: insertError.detail,
          hint: insertError.hint
        }
      })
    }

    // 7. Try count
    logs.push('\nSTEP 7: Testing count...')
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int as count FROM video_likes WHERE video_id = $1',
      [videoId]
    )
    logs.push(`✓ Count query succeeded: ${rows[0].count} likes`)

    logs.push('\n=== ALL TESTS PASSED ===')

    return res.json({
      success: true,
      logs,
      likeCount: rows[0].count
    })

  } catch (error: any) {
    logs.push(`\n❌ UNEXPECTED ERROR: ${error.message}`)
    logs.push(`Stack: ${error.stack}`)
    return res.status(500).json({
      success: false,
      logs,
      error: error.message,
      stack: error.stack
    })
  }
}
