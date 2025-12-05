import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateClientTokenFromReadWriteToken } from '@vercel/blob'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'

const DEFAULT_MAX_SIZE_MB = 200
const DEFAULT_MAX_SIZE_BYTES = DEFAULT_MAX_SIZE_MB * 1024 * 1024
const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/ogg',
  'video/3gpp',
  'video/3gpp2',
  'video/x-m4v',
  'video/3gp',
  'application/octet-stream',
  'image/jpeg',
  'image/png',
]

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { filename, size, contentType } = (req.body || {}) as {
    filename?: string
    size?: number
    contentType?: string
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ message: 'Blob storage is not configured.' })
  }

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ message: 'filename is required' })
  }

  if (typeof size === 'number' && size > DEFAULT_MAX_SIZE_BYTES) {
    return res.status(413).json({
      message: `Video is too large. Please keep uploads under ${DEFAULT_MAX_SIZE_MB}MB.`,
    })
  }

  const token = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: true,
    maximumSizeInBytes: DEFAULT_MAX_SIZE_BYTES,
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
    contentType: contentType || undefined,
  })

  return res.status(200).json({
    token,
    maximumSizeInBytes: DEFAULT_MAX_SIZE_BYTES,
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
  })
}

export default compose(cors, requireAuth, errorHandler)(handler)
