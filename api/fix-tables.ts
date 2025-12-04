import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getPgPool } from './_lib/clients'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pool = getPgPool()

  try {
    // Force drop and recreate tables
    await pool.query('DROP TABLE IF EXISTS video_likes CASCADE')
    await pool.query('DROP TABLE IF EXISTS video_comments CASCADE')
    await pool.query('DROP TABLE IF EXISTS video_shares CASCADE')

    await pool.query(`
      CREATE TABLE video_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      )
    `)

    await pool.query(`
      CREATE TABLE video_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        body TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await pool.query(`
      CREATE TABLE video_shares (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        video_id TEXT NOT NULL,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(video_id, user_id)
      )
    `)

    res.setHeader('Content-Type', 'text/plain')
    return res.send('SUCCESS! Tables recreated. Now try liking and commenting.')

  } catch (error: any) {
    res.setHeader('Content-Type', 'text/plain')
    return res.status(500).send(`FAILED: ${error.message}\n\n${error.stack}`)
  }
}
