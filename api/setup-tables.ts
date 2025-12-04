import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const pool = getPgPool()
  const logs: string[] = []

  try {
    logs.push('Starting table setup...')

    // Drop and recreate video_likes
    logs.push('Creating video_likes table...')
    await pool.query('DROP TABLE IF EXISTS video_likes CASCADE')
    await pool.query(`
      CREATE TABLE video_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      )
    `)
    await pool.query('CREATE INDEX idx_video_likes_video ON video_likes(video_id)')
    await pool.query('CREATE INDEX idx_video_likes_user ON video_likes(user_id)')
    logs.push('✓ video_likes table created')

    // Drop and recreate video_comments
    logs.push('Creating video_comments table...')
    await pool.query('DROP TABLE IF EXISTS video_comments CASCADE')
    await pool.query(`
      CREATE TABLE video_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await pool.query('CREATE INDEX idx_video_comments_video ON video_comments(video_id)')
    await pool.query('CREATE INDEX idx_video_comments_user ON video_comments(user_id)')
    logs.push('✓ video_comments table created')

    // Drop and recreate video_shares
    logs.push('Creating video_shares table...')
    await pool.query('DROP TABLE IF EXISTS video_shares CASCADE')
    await pool.query(`
      CREATE TABLE video_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      )
    `)
    await pool.query('CREATE INDEX idx_video_shares_video ON video_shares(video_id)')
    await pool.query('CREATE INDEX idx_video_shares_user ON video_shares(user_id)')
    logs.push('✓ video_shares table created')

    logs.push('All tables created successfully!')

    return res.json({
      success: true,
      logs,
      message: 'Tables created successfully. You can now like and comment on videos.'
    })

  } catch (error) {
    console.error('[SETUP] Error:', error)
    logs.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    return res.status(500).json({
      success: false,
      logs,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
