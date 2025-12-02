import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'
import { put } from '@vercel/blob'
import Busboy from 'busboy'

async function handler(req: VercelRequest, res: VercelResponse) {
  await initDatabase()

  if (req.method === 'POST') {
    return handleUpload(req, res)
  } else if (req.method === 'GET') {
    return handleGetVideos(req, res)
  } else {
    return res.status(405).json({ message: 'Method not allowed' })
  }
}

async function handleUpload(req: VercelRequest, res: VercelResponse) {
  const userId = (req as any).userId
  const pool = getPgPool()

  try {
    const fields: Record<string, string> = {}
    let videoFile: { buffer: Buffer; filename: string; mimetype: string } | null = null
    let thumbnailFile: { buffer: Buffer; filename: string; mimetype: string } | null = null

    // Get raw body from Vercel request
    const rawBody = (req as any).body

    // Check if it's JSON (no file upload)
    if (rawBody && typeof rawBody === 'object' && !Buffer.isBuffer(rawBody)) {
      const { title, description, videoUrl, thumbnailUrl, category, tags } = rawBody

      if (!title || !title.trim()) {
        return res.status(400).json({ message: 'Title is required' })
      }

      // Use provided URLs or placeholders
      const finalVideoUrl = videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
      const finalThumbnailUrl = thumbnailUrl || 'https://picsum.photos/seed/video/640/360'

      // Generate a text ID for the video
      const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Insert video into database
      const result = await pool.query(`
        INSERT INTO videos (id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds, created_at
      `, [videoId, userId, title.trim(), description || null, finalVideoUrl, finalThumbnailUrl, category || 'general', tags || [], 0])

      const video = result.rows[0]

      // Get user info
      const userResult = await pool.query(
        'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
        [userId]
      )

      const user = userResult.rows[0]

      return res.json({
        video: {
          id: video.id,
          title: video.title,
          description: video.description,
          videoUrl: video.video_url,
          thumbnailUrl: video.thumbnail_url,
          duration: video.duration_seconds,
          createdAt: video.created_at,
          user: {
            id: user.id,
            handle: user.handle,
            name: user.name,
            photoUrl: user.photo_url,
          },
          likes: 0,
          comments: 0,
          shares: 0,
          isLiked: false,
        },
      })
    }

    // Handle multipart/form-data file upload
    await new Promise<void>((resolve, reject) => {
      const busboy = Busboy({ headers: req.headers as any })
      const chunks: Buffer[] = []
      let currentField: string | null = null

      busboy.on('field', (fieldname: string, value: string) => {
        fields[fieldname] = value
      })

      busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
        currentField = fieldname
        const fileChunks: Buffer[] = []

        file.on('data', (data: Buffer) => {
          fileChunks.push(data)
        })

        file.on('end', () => {
          const buffer = Buffer.concat(fileChunks)

          if (fieldname === 'video') {
            videoFile = { buffer, filename: info.filename, mimetype: info.mimeType }
          } else if (fieldname === 'thumbnail') {
            thumbnailFile = { buffer, filename: info.filename, mimetype: info.mimeType }
          }
        })
      })

      busboy.on('finish', () => resolve())
      busboy.on('error', (err: Error) => reject(err))

      // Write body to busboy
      if (Buffer.isBuffer(rawBody)) {
        busboy.write(rawBody)
        busboy.end()
      } else if (typeof rawBody === 'string') {
        busboy.write(Buffer.from(rawBody))
        busboy.end()
      } else {
        reject(new Error('Unable to parse request body'))
      }
    })

    const { title, description, category, tags } = fields

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' })
    }

    if (!videoFile) {
      return res.status(400).json({ message: 'Video file is required' })
    }

    // Upload video to Vercel Blob
    const videoBlob = await put(`videos/${userId}/${Date.now()}_${videoFile.filename}`, videoFile.buffer, {
      access: 'public',
      contentType: videoFile.mimetype,
    })

    // Upload thumbnail if provided
    let thumbnailUrl = 'https://picsum.photos/seed/video/640/360'
    if (thumbnailFile) {
      const thumbnailBlob = await put(`thumbnails/${userId}/${Date.now()}_${thumbnailFile.filename}`, thumbnailFile.buffer, {
        access: 'public',
        contentType: thumbnailFile.mimetype,
      })
      thumbnailUrl = thumbnailBlob.url
    }

    // Generate a text ID for the video
    const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Parse tags if provided as JSON string
    let parsedTags: string[] = []
    if (tags) {
      try {
        parsedTags = JSON.parse(tags)
      } catch {
        parsedTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean)
      }
    }

    // Insert video into database
    const result = await pool.query(`
      INSERT INTO videos (id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds, created_at
    `, [videoId, userId, title.trim(), description || null, videoBlob.url, thumbnailUrl, category || 'general', parsedTags, 0])

    const video = result.rows[0]

    // Get user info
    const userResult = await pool.query(
      'SELECT id, handle, name, photo_url FROM users WHERE id = $1',
      [userId]
    )

    const user = userResult.rows[0]

    res.json({
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        videoUrl: video.video_url,
        thumbnailUrl: video.thumbnail_url,
        duration: video.duration_seconds,
        createdAt: video.created_at,
        user: {
          id: user.id,
          handle: user.handle,
          name: user.name,
          photoUrl: user.photo_url,
        },
        likes: 0,
        comments: 0,
        shares: 0,
        isLiked: false,
      },
    })
  } catch (error) {
    console.error('Error uploading video:', error)
    throw error
  }
}

async function handleGetVideos(req: VercelRequest, res: VercelResponse) {
  const pool = getPgPool()

  try {
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0

    const result = await pool.query(`
      SELECT
        v.id,
        v.title,
        v.description,
        v.video_url,
        v.thumbnail_url,
        v.duration_seconds,
        v.created_at,
        u.id as user_id,
        u.handle,
        u.name,
        u.photo_url,
        (SELECT COUNT(*) FROM video_likes WHERE video_id = v.id) as likes_count,
        (SELECT COUNT(*) FROM video_comments WHERE video_id = v.id) as comments_count,
        (SELECT COUNT(*) FROM video_shares WHERE video_id = v.id) as shares_count
      FROM videos v
      LEFT JOIN users u ON v.user_id = u.id
      ORDER BY v.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset])

    const videos = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      videoUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url,
      duration: row.duration_seconds,
      createdAt: row.created_at,
      user: {
        id: row.user_id,
        handle: row.handle,
        name: row.name,
        photoUrl: row.photo_url,
      },
      likes: parseInt(row.likes_count) || 0,
      comments: parseInt(row.comments_count) || 0,
      shares: parseInt(row.shares_count) || 0,
      isLiked: false,
    }))

    res.json({ videos })
  } catch (error) {
    console.error('Error fetching videos:', error)
    throw error
  }
}

export default compose(cors, errorHandler, requireAuth)(handler)
