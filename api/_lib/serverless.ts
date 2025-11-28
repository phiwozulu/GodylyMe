import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ZodSchema } from 'zod'
import { initDatabase } from './initDatabase'

export type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>

/**
 * Database initialization middleware.
 * Ensures all database tables exist before processing the request.
 * Only runs once per serverless function instance (cold start).
 */
export function withDatabase(handler: Handler): Handler {
  return async (req: VercelRequest, res: VercelResponse) => {
    await initDatabase()
    return handler(req, res)
  }
}

export function cors(handler: Handler): Handler {
  return async (req: VercelRequest, res: VercelResponse) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    )

    if (req.method === 'OPTIONS') {
      res.status(200).end()
      return
    }

    return handler(req, res)
  }
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (handler: (req: VercelRequest, res: VercelResponse, body: T) => Promise<void | VercelResponse>): Handler => {
    return async (req: VercelRequest, res: VercelResponse) => {
      try {
        const body = schema.parse(req.body)
        return handler(req, res, body)
      } catch (error) {
        return res.status(400).json({ message: 'Invalid request body', error })
      }
    }
  }
}

export function errorHandler(handler: Handler): Handler {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      await handler(req, res)
    } catch (error) {
      console.error('Serverless function error:', error)
      const message = error instanceof Error ? error.message : 'Internal server error'
      res.status(500).json({ message })
    }
  }
}

export function compose(...handlers: ((h: Handler) => Handler)[]): (h: Handler) => Handler {
  return (handler: Handler) => {
    return handlers.reduceRight((acc, fn) => fn(acc), handler)
  }
}
