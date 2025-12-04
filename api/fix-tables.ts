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

    res.setHeader('Content-Type', 'text/html')
    return res.send(`
      <!DOCTYPE html>
      <html>
      <body style="font-family: monospace; padding: 40px; background: #0a0a0a; color: #00ff00;">
        <h1>✓ SUCCESS!</h1>
        <p>Tables have been recreated with correct schema.</p>
        <p>Now close your app and reopen it, then try liking and commenting.</p>
      </body>
      </html>
    `)

  } catch (error: any) {
    res.setHeader('Content-Type', 'text/html')
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <body style="font-family: monospace; padding: 40px; background: #0a0a0a; color: #ff0000;">
        <h1>✗ FAILED</h1>
        <pre>${error.message}\n\n${error.stack}</pre>
      </body>
      </html>
    `)
  }
}
