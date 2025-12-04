import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pool = getPgPool()
  const logs: string[] = []

  try {
    logs.push('Starting migration...')

    // Drop and recreate video_likes table
    logs.push('Dropping video_likes table...')
    await pool.query('DROP TABLE IF EXISTS video_likes CASCADE;')

    logs.push('Creating video_likes table...')
    await pool.query(`
      CREATE TABLE video_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      );
    `)
    logs.push('video_likes table created')

    // Drop and recreate video_comments table
    logs.push('Dropping video_comments table...')
    await pool.query('DROP TABLE IF EXISTS video_comments CASCADE;')

    logs.push('Creating video_comments table...')
    await pool.query(`
      CREATE TABLE video_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)
    logs.push('video_comments table created')

    // Drop and recreate video_shares table
    logs.push('Dropping video_shares table...')
    await pool.query('DROP TABLE IF EXISTS video_shares CASCADE;')

    logs.push('Creating video_shares table...')
    await pool.query(`
      CREATE TABLE video_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      );
    `)
    logs.push('video_shares table created')

    // Create indexes
    logs.push('Creating indexes...')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_likes_user ON video_likes(user_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_comments_video ON video_comments(video_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_comments_user ON video_comments(user_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_shares_video ON video_shares(video_id);')
    await pool.query('CREATE INDEX IF NOT EXISTS idx_video_shares_user ON video_shares(user_id);')
    logs.push('Indexes created')

    logs.push('Migration completed successfully!')

    res.json({
      success: true,
      logs,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[MIGRATE] Error:', error)
    logs.push(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    res.status(500).json({
      success: false,
      logs,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}
