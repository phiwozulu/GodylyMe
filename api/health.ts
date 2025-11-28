import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, withDatabase } from './_lib/serverless'
import { getPgPool, getRedis } from './_lib/clients'

async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const pool = getPgPool()
    await pool.query('SELECT 1')

    const redis = getRedis()
    await redis.ping()

    res.json({ status: 'ok', database: 'connected', redis: 'connected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connectivity issue'
    res.status(503).json({ status: 'error', message })
  }
}

export default compose(withDatabase, cors, errorHandler)(handler)
