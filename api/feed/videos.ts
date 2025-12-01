import type { VercelRequest, VercelResponse } from '@vercel/node'
import { compose, cors, errorHandler, requireAuth } from '../_lib/serverless'
import { getPgPool } from '../_lib/clients'
import { initDatabase } from '../_lib/initDatabase'
import formidable from 'formidable'

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
    // Parse multipart form data
    const form = formidable({
      maxFileSize: parseInt(process.env.UPLOAD_MAX_BYTES || '209715200'), // 200MB default
    })

    const [fields, files] = await form.parse(req)

    const title = Array.isArray(fields.title) ? fields.title[0] : fields.title
    const description = Array.isArray(fields.description) ? fields.description[0] : fields.description
    const videoUrl = Array.isArray(fields.videoUrl) ? fields.videoUrl[0] : fields.videoUrl
    const thumbnailUrl = Array.isArray(fields.thumbnailUrl) ? fields.thumbnailUrl[0] : fields.thumbnailUrl
    const category = Array.isArray(fields.category) ? fields.category[0] : fields.category

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' })
    }

    // For now, we'll store the placeholder URLs
    // In production, you'd upload to S3/Cloudinary and get real URLs
    const finalVideoUrl = videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
    const finalThumbnailUrl = thumbnailUrl || 'https://picsum.photos/seed/video/640/360'

    // Generate a text ID for the video (matching existing schema)
    const videoId = `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Insert video into database (existing schema uses TEXT id, category, tags, duration_seconds)
    const result = await pool.query(`
      INSERT INTO videos (id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds, created_at
    `, [videoId, userId, title.trim(), description || null, finalVideoUrl, finalThumbnailUrl, category || 'general', [], 0])

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
