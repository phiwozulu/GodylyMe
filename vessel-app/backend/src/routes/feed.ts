import { Router, type Request, type Express } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'
import { requireAuth } from '../utils/authMiddleware'
import { enforceModeration } from '../utils/moderation'
import {
  createVideoRecord,
  deleteVideoRecord,
  getVideoById,
  listRecentVideos,
  listVideosByAuthors,
  DEFAULT_THUMBNAIL_URL,
  type FeedVideoRecord,
} from '../services/videoFeedService'
import { findUserByHandle, findUserById, presentUser } from '../services/userService'
import { listFollowing } from '../services/followService'

const router = Router()
const VIDEO_FILE_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'])

const uploadDir = path.resolve(process.cwd(), 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.mp4'
    cb(null, `${unique}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 200 * 1024 * 1024),
  },
})

const uploadSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(2000).optional(),
  category: z.string().max(64).optional(),
  tags: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  durationSeconds: z.coerce.number().int().nonnegative().optional(),
})

router.get('/for-you', async (req, res, next) => {
  try {
    const { limit, cursor } = parsePaginationQuery(req.query)
    const videos = await listRecentVideos({
      limit,
      cursor,
    })
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

router.get('/following', requireAuth, async (req, res, next) => {
  try {
    const { limit, cursor } = parsePaginationQuery(req.query)
    const follower = await listFollowing(req.authUser!.id)
    if (!follower.length) {
      return res.json({ videos: [] })
    }
    const videos = await listVideosByAuthors(
      follower.map((user) => user.id),
      { limit, cursor }
    )
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { limit, cursor } = parsePaginationQuery(req.query)
    const videos = await listVideosByAuthors([req.authUser!.id], { limit, cursor })
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

router.get('/profiles/:profileId', async (req, res, next) => {
  try {
    const identifier = (req.params.profileId || '').trim()
    if (!identifier) {
      return res.status(400).json({ message: 'profileId is required' })
    }
    const authorId = await resolveAuthorId(identifier)
    if (!authorId) {
      return res.status(404).json({ message: 'Creator not found.' })
    }
    const { limit, cursor } = parsePaginationQuery(req.query)
    const videos = await listVideosByAuthors([authorId], { limit, cursor })
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

router.post(
  '/videos',
  requireAuth,
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ]),
  async (req, res, next) => {
  try {
    const payload = uploadSchema.parse(req.body)
    const tags = parseTags(payload.tags)
    enforceModeration('upload', [
      { label: 'Title', text: payload.title },
      { label: 'Description', text: payload.description ?? '' },
    ])

    let videoUrl = payload.videoUrl?.trim() ?? ''
    let thumbnailUrl = payload.thumbnailUrl?.trim() ?? ''

    const uploadedFile = pickUploadedFile(req)
    if (uploadedFile) {
      const publicPath = `/uploads/${uploadedFile.filename}`
      videoUrl = buildPublicUrl(req, publicPath)
      if (!thumbnailUrl) {
        thumbnailUrl = ''
      }
    }
    thumbnailUrl = resolveThumbnailUrl(thumbnailUrl, videoUrl)

    if (!videoUrl) {
      return res.status(400).json({ message: 'Upload a video file or provide videoUrl.' })
    }

    const record = await createVideoRecord({
      userId: req.authUser!.id,
      title: payload.title.trim(),
      description: payload.description?.trim() ?? null,
      category: payload.category?.trim() ?? 'testimony',
      tags,
      videoUrl,
      thumbnailUrl,
      durationSeconds: payload.durationSeconds ?? 0,
    })

    res.status(201).json({ video: presentFeedVideo(record) })
  } catch (error) {
    next(error)
  }
  }
)

router.delete('/videos/:videoId', requireAuth, async (req, res, next) => {
  try {
    const videoId = (req.params.videoId || '').trim()
    if (!videoId) {
      return res.status(400).json({ message: 'videoId is required' })
    }
    const record = await getVideoById(videoId)
    if (!record) {
      return res.status(404).json({ message: 'Video not found.' })
    }
    if (record.user.id !== req.authUser!.id) {
      return res.status(403).json({ message: 'You can only delete your own uploads.' })
    }
    const deleted = await deleteVideoRecord(videoId, req.authUser!.id)
    if (!deleted) {
      return res.status(404).json({ message: 'Video not found.' })
    }
    await deleteUploadedAssets([record.video_url, record.thumbnail_url])
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

function parsePaginationQuery(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50)
  const cursorParam = typeof query.cursor === 'string' ? query.cursor : null
  const cursorCandidate = cursorParam ? new Date(cursorParam) : undefined
  const cursor = cursorCandidate && Number.isNaN(cursorCandidate.getTime()) ? undefined : cursorCandidate
  return { limit, cursor }
}

function parseTags(value?: string): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0)
    }
  } catch {
    // ignore JSON parse failure and fall back to comma parsing
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

function buildPublicUrl(req: Request, relativePath: string) {
  const origin = `${req.protocol}://${req.get('host')}`
  if (relativePath.startsWith('http')) {
    return relativePath
  }
  return `${origin}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`
}

async function resolveAuthorId(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim()
  if (!trimmed) {
    return null
  }
  const normalizedHandle = trimmed.replace(/^@/, '').toLowerCase()
  const byHandle = await findUserByHandle(normalizedHandle)
  if (byHandle) {
    return byHandle.id
  }
  if (/^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$/i.test(trimmed)) {
    const byId = await findUserById(trimmed)
    if (byId) {
      return byId.id
    }
  }
  return null
}

function presentFeedVideo(row: FeedVideoRecord) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    videoUrl: row.video_url,
    thumbnailUrl: resolveThumbnailUrl(row.thumbnail_url, row.video_url),
    category: row.category,
    tags: row.tags ?? [],
    durationSeconds: row.duration_seconds ?? 0,
    createdAt: row.created_at.toISOString(),
    stats: {
      likes: row.like_count ?? 0,
      comments: row.comment_count ?? 0,
    },
    user: presentUser(row.user),
  }
}

function resolveThumbnailUrl(candidate?: string | null, fallbackVideo?: string | null): string {
  const trimmedCandidate = (candidate ?? '').trim()
  if (trimmedCandidate && !isLikelyVideoAsset(trimmedCandidate)) {
    return trimmedCandidate
  }
  const trimmedFallback = (fallbackVideo ?? '').trim()
  if (trimmedFallback && !isLikelyVideoAsset(trimmedFallback)) {
    return trimmedFallback
  }
  return DEFAULT_THUMBNAIL_URL
}

function isLikelyVideoAsset(url?: string | null): boolean {
  if (!url) return false
  const trimmed = url.trim()
  if (!trimmed) return false
  const pathname = (() => {
    try {
      const parsed = new URL(trimmed)
      return parsed.pathname
    } catch {
      return trimmed
    }
  })()
  const sanitized = pathname.split('?')[0]?.split('#')[0] ?? pathname
  const ext = path.extname(sanitized).toLowerCase()
  return VIDEO_FILE_EXTENSIONS.has(ext)
}

async function deleteUploadedAssets(urls: Array<string | null | undefined>): Promise<void> {
  const targets = urls
    .map((url) => resolveLocalUploadPath(url))
    .filter((assetPath): assetPath is string => Boolean(assetPath))
  await Promise.all(
    targets.map(async (assetPath) => {
      try {
        await fs.promises.unlink(assetPath)
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          // eslint-disable-next-line no-console
          console.warn('Unable to delete uploaded asset', assetPath, error)
        }
      }
    })
  )
}

function resolveLocalUploadPath(assetUrl?: string | null): string | null {
  if (!assetUrl) {
    return null
  }
  const trimmed = assetUrl.trim()
  if (!trimmed) return null
  const pathname = (() => {
    try {
      const parsed = new URL(trimmed)
      return parsed.pathname
    } catch {
      return trimmed
    }
  })()
  if (!pathname.startsWith('/uploads/')) {
    return null
  }
  const relativePath = pathname.replace('/uploads/', '')
  const normalized = path.normalize(relativePath)
  const resolved = path.resolve(uploadDir, normalized)
  const relativeToUpload = path.relative(uploadDir, resolved)
  if (relativeToUpload.startsWith('..') || path.isAbsolute(relativeToUpload)) {
    return null
  }
  return resolved
}

function pickUploadedFile(req: Request): Express.Multer.File | undefined {
  const maybeFile = (req as Request & { file?: Express.Multer.File }).file
  if (maybeFile) {
    return maybeFile
  }
  const files = (req as Request & { files?: Record<string, Express.Multer.File[]> | Express.Multer.File[] }).files
  if (!files) return undefined
  if (Array.isArray(files)) {
    return files[0]
  }
  return files.file?.[0] ?? files.video?.[0]
}

export default router
