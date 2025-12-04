import {
  videos as seedVideos,
  curatedGuides,
  formatLikes,
  type Video,
  type VesselGuide,
  type ContentCategory,
  type ContentCollection,
} from './mockData'
import { aiModerator } from './aiModerator'

type Listener = () => void

const ACTIVE_USER_NAME_KEY = 'vessel_user'
const ACTIVE_USER_ID_KEY = 'vessel_user_id'
const ACTIVE_USER_CHURCH_KEY = 'vessel_user_church'
const ACTIVE_USER_COUNTRY_KEY = 'vessel_user_country'
const ACTIVE_USER_PHOTO_KEY = 'vessel_user_photo'
const ACTIVE_USER_EMAIL_KEY = 'vessel_user_email'
const ACTIVE_USER_VERIFIED_KEY = 'vessel_user_verified'
const AUTH_TOKEN_KEY = 'vessel_auth_token'
const UPLOAD_STORAGE_KEY = 'vessel_user_uploads_v1'
const FOLLOWING_STORAGE_KEY = 'vessel_following_ids_v1'
const BOOKMARK_STORAGE_KEY = 'vessel_bookmarks_v1'
const LIKES_STORAGE_KEY = 'vessel_likes_v1'
const DEFAULT_VIDEO_PLACEHOLDER = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
const DEFAULT_THUMB_PLACEHOLDER = 'https://placehold.co/640x360?text=Vessel'
export const THUMBNAIL_PLACEHOLDER = DEFAULT_THUMB_PLACEHOLDER
export const VIDEO_PLACEHOLDER = DEFAULT_VIDEO_PLACEHOLDER
const NETWORK_DELAY_MIN = 220
const NETWORK_DELAY_MAX = 520
const NETWORK_FAILURE_RATE = 0.05
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])
const MODERATION_CONTEXT_PROFILE = 'profile'
const MODERATION_CONTEXT_UPLOAD = 'upload'
const API_BASE_URL = resolveApiBaseUrl()
const VIDEO_FILE_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.avi', '.mkv'])
let remoteFeed: Video[] = []

type StoredUpload = Omit<Video, 'videoUrl'>
type CommentableVideo = Video

const USE_SEEDS = import.meta.env.VITE_USE_SEEDS === 'true'

const normalizedSeedVideos: Video[] = seedVideos.map((clip) => ({
  ...clip,
  thumbnailUrl: resolveThumbnailUrl(clip.thumbnailUrl, clip.videoUrl),
}))

function normalizeHandleMatch(value?: string | null): string {
  return (value || '').trim().replace(/^@/, '').toLowerCase()
}

async function searchLocal(query: string, limit = 20) {
  const trimmed = (query || '').trim().toLowerCase()
  if (!trimmed) return { accounts: [], videos: [], categories: [] }

  const isHandleQuery = trimmed.startsWith('@')
  const key = isHandleQuery ? trimmed.slice(1) : trimmed

  const library = getLibrary()
  const videoMatches = library
    .filter((clip) => {
      if (isHandleQuery) {
        const handle = clip.user.handle || clip.user.accountId || clip.user.id || ''
        return handle.toLowerCase().includes(key)
      }
      return (
        (clip.title || '').toLowerCase().includes(key) ||
        (clip.description || '').toLowerCase().includes(key) ||
        (clip.tags || []).some((t) => (t || '').toLowerCase().includes(key)) ||
        (clip.user.name || '').toLowerCase().includes(key) ||
        (clip.user.handle || '').toLowerCase().includes(key)
      )
    })
    .slice(0, limit)

  const creatorsByHandle = new Map<
    string,
    { id: string; handle?: string; name?: string; photoUrl?: string | null; church?: string | null }
  >()
  for (const clip of library) {
    const handle = (clip.user.handle || clip.user.id || clip.user.accountId || '').trim()
    if (!handle) continue
    const k = handle.toLowerCase()
    if (!creatorsByHandle.has(k)) {
      creatorsByHandle.set(k, {
        id: clip.user.id || k,
        handle: clip.user.handle || undefined,
        name: clip.user.name || clip.user.handle || clip.user.id,
        photoUrl: clip.user.avatar || null,
        church: clip.user.churchHome ?? null,
      })
    }
  }
  const allCreators = Array.from(creatorsByHandle.values())
  const accountMatches = allCreators
    .filter((c) => {
      if (isHandleQuery) return (c.handle || c.id || '').toLowerCase().includes(key)
      return (
        (c.handle || c.id || '').toLowerCase().includes(key) ||
        (c.name || '').toLowerCase().includes(key) ||
        (c.church || '').toLowerCase().includes(key)
      )
    })
    .slice(0, limit)

  const categories = new Set<string>()
  for (const clip of library) {
    if (clip.category) categories.add((clip.category || '').toLowerCase())
    ;(clip.tags || []).forEach((t) => {
      if (t && t.trim()) categories.add(t.toLowerCase())
    })
  }
  const categoryMatches = Array.from(categories).filter((c) => c.includes(key)).slice(0, limit)

  const accounts = accountMatches.map((c) => ({
    id: c.id,
    handle: c.handle || c.id,
    name: c.name || c.handle || c.id,
    photoUrl: c.photoUrl ?? null,
    church: c.church ?? null,
  }))

  return { accounts, videos: videoMatches, categories: categoryMatches }
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
  return DEFAULT_THUMB_PLACEHOLDER
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
  const dotIndex = sanitized.lastIndexOf('.')
  const ext = dotIndex >= 0 ? sanitized.slice(dotIndex).toLowerCase() : ''
  return VIDEO_FILE_EXTENSIONS.has(ext)
}

/**
 * Generate a thumbnail from a video file by capturing a frame at 1 second
 */
async function generateVideoThumbnail(videoFile: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(null)
        return
      }

      video.preload = 'metadata'
      video.muted = true
      video.playsInline = true

      video.onloadedmetadata = () => {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Seek to 1 second (or 10% of video duration, whichever is less)
        const seekTime = Math.min(1, video.duration * 0.1)
        video.currentTime = seekTime
      }

      video.onseeked = () => {
        try {
          // Draw video frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Convert canvas to blob
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(video.src)
              resolve(blob)
            },
            'image/jpeg',
            0.85 // Quality
          )
        } catch (err) {
          console.error('Error capturing video frame:', err)
          URL.revokeObjectURL(video.src)
          resolve(null)
        }
      }

      video.onerror = () => {
        console.error('Error loading video for thumbnail generation')
        URL.revokeObjectURL(video.src)
        resolve(null)
      }

      // Create object URL and load video
      video.src = URL.createObjectURL(videoFile)
    } catch (err) {
      console.error('Error in generateVideoThumbnail:', err)
      resolve(null)
    }
  })
}

type ApiVideoComment = {
  id: string
  videoId: string
  body: string
  createdAt: string
  user: ApiUser
}

type VideoComment = {
  id: string
  videoId: string
  body: string
  createdAt: string
  user: ApiUser
}

type ActiveProfile = {
  id: string
  name: string
  church: string
  country: string
  email: string
  photo?: string
  isVerified: boolean
}

type ActiveProfileUpdate = {
  id?: string
  name?: string
  church?: string | null
  country?: string | null
  email?: string | null
  photo?: string | null
  isVerified?: boolean | null
}

type EmailVerificationResult = {
  valid: boolean
  message?: string
}

type ApiUser = {
  id: string
  handle: string
  name: string
  email: string
  church: string | null
  country: string | null
  photoUrl: string | null
  isVerified: boolean
}

type ContactMatch = {
  id: string
  handle: string
  name: string
  email: string
  church: string | null
  country: string | null
  photoUrl: string | null
}

type SuggestedConnection = {
  id: string
  handle: string
  name: string
  church?: string | null
  country?: string | null
  photoUrl?: string | null
  summary?: string | null
  mutualConnections: number
}

type ApiSuggestedConnection = ApiUser & {
  mutualConnections?: number
  summary?: string | null
}

type ApiThreadMessage = {
  id: string
  threadId: string
  body: string
  createdAt: string
  sender: {
    id: string
    handle: string
    name: string
    church?: string | null
    country?: string | null
    photoUrl?: string | null
  }
}

type ApiThreadSummary = {
  id: string
  subject?: string | null
  participants: ApiUser[]
  lastMessage?: ApiThreadMessage | null
  unreadCount: number
  updatedAt: string
}

type ApiNotificationSummary = {
  id: string
  type: 'follow' | 'like' | 'comment'
  createdAt: string
  videoId?: string | null
  videoTitle?: string | null
  commentPreview?: string | null
  actor: ApiUser
}

type ThreadParticipant = {
  id: string
  handle: string
  name: string
  church?: string | null
  country?: string | null
  photoUrl?: string | null
}

type ThreadMessage = {
  id: string
  threadId: string
  body: string
  createdAt: string
  sender: ThreadParticipant
}

type MessageThread = {
  id: string
  subject?: string | null
  participants: ThreadParticipant[]
  lastMessage?: ThreadMessage | null
  unreadCount: number
  updatedAt: string
}

type NotificationSummary = {
  id: string
  type: 'follow' | 'like' | 'comment'
  createdAt: string
  actor: {
    id: string
    handle?: string
    name: string
    photoUrl?: string
  }
  videoId?: string | null
  videoTitle?: string | null
  commentPreview?: string | null
}

type FollowStats = {
  followers: number
  following: number
}

type ApiFeedVideo = {
  id: string
  title: string
  description?: string | null
  category?: string | null
  tags?: string[]
  durationSeconds?: number
  videoUrl: string
  thumbnailUrl?: string | null
  createdAt: string
  stats?: {
    likes?: number
    comments?: number
  }
  user: {
    id: string
    name?: string | null
    handle: string
    church?: string | null
    country?: string | null
    photoUrl?: string | null
  }
}

const listeners = new Set<Listener>()
let uploadsHydrated = false
let uploads: Video[] = []
let followedHydrated = false
let followedIds = new Set<string>()
let followingFetchPromise: Promise<void> | null = null
let bookmarksHydrated = false
let bookmarkedIds = new Set<string>()
let likesHydrated = false
let likedByUser: Record<string, Set<string>> = {}

type ModerationContext = 'profile' | 'upload' | 'message' | 'comment'
type ModerationFieldInput = {
  label: string
  text: string
}

function enforceModeration(context: ModerationContext, fields: ModerationFieldInput[]) {
  const sanitizedFields = fields
    .map((field) => ({ label: field.label, text: field.text.trim() }))
    .filter((field) => field.text.length > 0)

  if (!sanitizedFields.length) return

  const outcome = aiModerator.review({ context, fields: sanitizedFields })
  if (!outcome.approved) {
    const primary = outcome.issues[0]
    const reason = primary ? `${primary.reason} (${primary.field}).` : 'Content needs another pass before sharing.'
    throw new Error(reason)
  }
}

function getActiveUserId(): string {
  if (typeof window === 'undefined') return 'me'
  const existing = window.localStorage.getItem(ACTIVE_USER_ID_KEY)
  if (existing) return existing
  const generated = `user-${Math.random().toString(36).slice(2, 8)}`
  window.localStorage.setItem(ACTIVE_USER_ID_KEY, generated)
  return generated
}

function getActiveUserName(): string {
  if (typeof window === 'undefined') return 'Guest Creator'
  return window.localStorage.getItem(ACTIVE_USER_NAME_KEY) || 'Guest Creator'
}

function getActiveUserChurch(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_CHURCH_KEY) || ''
}

function getActiveUserCountry(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_COUNTRY_KEY) || ''
}

function getActiveUserVerified(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(ACTIVE_USER_VERIFIED_KEY) === 'true'
}

function verifyEmailStructure(email: string): EmailVerificationResult {
  const trimmed = email.trim().toLowerCase()
  if (!trimmed) return { valid: false, message: 'Enter an email' }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    return { valid: false, message: 'Enter a valid email' }
  }
  const domain = trimmed.slice(trimmed.indexOf('@') + 1)
  if (!GMAIL_DOMAINS.has(domain)) {
    return { valid: true }
  }
  const local = trimmed.slice(0, trimmed.indexOf('@'))
  if (local.length < 6 || local.length > 30) {
    return { valid: false, message: 'Gmail usernames must be between 6 and 30 characters.' }
  }
  if (!/^[a-z0-9.]+$/.test(local)) {
    return { valid: false, message: 'Gmail usernames can only include letters, numbers, and periods.' }
  }
  if (local.startsWith('.') || local.endsWith('.')) {
    return { valid: false, message: 'Gmail usernames cannot start or end with a period.' }
  }
  if (local.includes('..')) {
    return { valid: false, message: 'Gmail usernames cannot contain consecutive periods.' }
  }
  return { valid: true, message: 'Gmail address format looks good.' }
}

function getActiveUserPhoto(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_PHOTO_KEY) || ''
}

function getActiveUserEmail(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACTIVE_USER_EMAIL_KEY) || ''
}

function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

function hasAuthSession(): boolean {
  return Boolean(getStoredAuthToken())
}

function hasProfileSession(): boolean {
  // Treat users who have a stored profile (e.g., cookie session) as authenticated even if a token is missing.
  return Boolean(getActiveUserEmail() && getActiveUserId())
}

function requireVerifiedSession(action: string): void {
  if (!hasAuthSession()) {
    throw new Error(`Sign in to ${action}.`)
  }
  const profile = getActiveProfile()
  if (!profile.isVerified) {
    throw new Error(`Only verified GodlyMe profiles can ${action}.`)
  }
}

function setStoredAuthToken(token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
  bookmarksHydrated = false
  bookmarkedIds = new Set()
  likesHydrated = false
  likedByUser = {}
}

function requireApiBaseUrl(): string {
  const base = API_BASE_URL || resolveApiBaseUrl()
  if (!base) {
    throw new Error('VITE_API_BASE_URL is not configured for this build.')
  }
  return base
}

function resolveApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL || '').trim()
  const sanitized = raw.replace(/\/$/, '')

  if (!sanitized) {
    if (typeof window !== 'undefined' && window.location.origin) {
      return window.location.origin.replace(/\/$/, '')
    }
    return ''
  }

  if (typeof window === 'undefined') {
    return sanitized
  }

  try {
    const parsed = new URL(sanitized)
    const currentHost = window.location.hostname
    const isCurrentHostLoopback = currentHost ? LOOPBACK_HOSTS.has(currentHost) : false
    if (currentHost && !isCurrentHostLoopback && LOOPBACK_HOSTS.has(parsed.hostname)) {
      parsed.hostname = currentHost
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    try {
      if (typeof window !== 'undefined' && window.location.origin) {
        const resolved = new URL(sanitized, window.location.origin)
        return resolved.toString().replace(/\/$/, '')
      }
    } catch {
      // Fall through to returning sanitized value
    }
    return sanitized
  }
}

async function requestJson<T>(path: string, init: RequestInit = {}, includeAuth = false): Promise<T> {
  const baseUrl = requireApiBaseUrl()
  const headers = new Headers(init.headers || {})
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (includeAuth) {
    const token = getStoredAuthToken()
    if (!token) {
      throw new Error('Please sign in to continue.')
    }
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })

  let payload: unknown = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'message' in payload ? (payload as any).message : null
    const error = new Error(message || 'Request failed. Please try again.')
    ;(error as any).status = response.status
    ;(error as any).payload = payload
    throw error
  }

  return payload as T
}

async function postJson<T>(path: string, body: unknown, includeAuth = false): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    includeAuth
  )
}

async function getJson<T>(path: string, includeAuth = false): Promise<T> {
  return requestJson<T>(path, { method: 'GET' }, includeAuth)
}

async function deleteJson(path: string, includeAuth = false): Promise<void> {
  await requestJson(path, { method: 'DELETE' }, includeAuth)
}

function applyApiUserSession(user: ApiUser, token?: string | null): ActiveProfile {
  if (token) {
    setStoredAuthToken(token)
    void refreshFollowingFromServer(true)
  } else if (token === null) {
    setStoredAuthToken(null)
    followedHydrated = false
    followedIds.clear()
  }

  return updateActiveProfile({
    id: user.handle || user.id,
    name: user.name,
    church: user.church ?? '',
    country: user.country ?? '',
    email: user.email,
    photo: user.photoUrl ?? undefined,
    isVerified: user.isVerified,
  })
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-')
}

function slugifyDisplayName(value: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return base || `guest-${Math.random().toString(36).slice(2, 6)}`
}

function sanitizeHandle(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
}

function generateHandleSuggestion(value: string): string {
  if (!value.trim()) return ''
  const sanitized = sanitizeHandle(value)
  if (sanitized) return sanitized
  const fallback = slugifyDisplayName(value).replace(/-/g, '')
  return fallback || `friend${Math.random().toString(36).slice(2, 6)}`
}

function hashPassword(email: string, password: string): string {
  const input = `${email.toLowerCase()}::${password}`
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(16)
}

function simulateNetwork<T>(fn: () => T, failureRate = NETWORK_FAILURE_RATE): Promise<T> {
  const delay = NETWORK_DELAY_MIN + Math.random() * (NETWORK_DELAY_MAX - NETWORK_DELAY_MIN)
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (Math.random() < failureRate) {
        reject(new Error('Please try again in a moment.'))
        return
      }
      try {
        resolve(fn())
      } catch (err) {
        reject(err)
      }
    }, delay)
  })
}

function ensureUploadsHydrated() {
  if (uploadsHydrated || typeof window === 'undefined') return
  uploadsHydrated = true
  const raw = window.localStorage.getItem(UPLOAD_STORAGE_KEY)
  if (!raw) return
  try {
    const stored = JSON.parse(raw) as StoredUpload[]
    uploads = stored.map(reviveStoredUpload)
  } catch {
    uploads = []
  }
}

function persistUploads() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(UPLOAD_STORAGE_KEY, JSON.stringify(uploads.map(makeSerializableUpload)))
}

function ensureFollowingHydrated() {
  if (followedHydrated || typeof window === 'undefined') return
  followedHydrated = true
  if (hasAuthSession()) {
    followedIds = new Set()
    void refreshFollowingFromServer(true)
    return
  }
  followedIds = new Set()
}

function refreshFollowingFromServer(force = false): Promise<void> | undefined {
  if (!hasAuthSession()) {
    return undefined
  }
  if (followingFetchPromise && !force) {
    return followingFetchPromise
  }
  followingFetchPromise = getJson<{ following: ApiUser[] }>('/api/follows/following', true)
    .then((payload) => {
      followedIds = new Set(payload.following.map((user) => normalizeId(user.handle || user.id)))
      notify()
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to refresh following list', error)
    })
    .finally(() => {
      followingFetchPromise = null
    })
  return followingFetchPromise
}

function getFollowedIds(): Set<string> {
  ensureFollowingHydrated()
  return followedIds
}

function ensureBookmarksHydrated() {
  if (bookmarksHydrated || typeof window === 'undefined') return
  bookmarksHydrated = true
  if (!hasAuthSession()) {
    bookmarkedIds = new Set()
    return
  }
  const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as string[]
      if (parsed.length) {
        bookmarkedIds = new Set(parsed)
        return
      }
    } catch {
      bookmarkedIds = new Set()
    }
  }
  bookmarkedIds = new Set()
}

function persistBookmarks() {
  if (typeof window === 'undefined' || !hasAuthSession()) return
  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify([...bookmarkedIds]))
}

function ensureLikesHydrated() {
  if (likesHydrated || typeof window === 'undefined') return
  likesHydrated = true
  likedByUser = {}
  const raw = window.localStorage.getItem(LIKES_STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as Record<string, string[]>
    Object.entries(parsed).forEach(([userId, ids]) => {
      likedByUser[userId] = new Set(ids)
    })
  } catch {
    likedByUser = {}
  }
}

function persistLikes() {
  if (typeof window === 'undefined' || !hasAuthSession()) return
  const serialized: Record<string, string[]> = {}
  Object.entries(likedByUser).forEach(([userId, ids]) => {
    serialized[userId] = [...ids]
  })
  window.localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(serialized))
}

function getLikedIdsForUser(userId: string): Set<string> {
  ensureLikesHydrated()
  const normalizedUser = normalizeId(userId || 'guest')
  if (!likedByUser[normalizedUser]) {
    likedByUser[normalizedUser] = new Set()
  }
  return likedByUser[normalizedUser]
}

function addLikeForUser(userId: string, clipId: string) {
  const likedIds = getLikedIdsForUser(userId)
  if (!likedIds.has(clipId)) {
    likedIds.add(clipId)
    persistLikes()
  }
}

function removeLikeForUser(userId: string, clipId: string) {
  const likedIds = getLikedIdsForUser(userId)
  if (likedIds.has(clipId)) {
    likedIds.delete(clipId)
    persistLikes()
  }
}

function getLikedClipsForUser(userId: string): Video[] {
  if (!hasAuthSession()) return []
  const likedIds = getLikedIdsForUser(userId)
  if (!likedIds.size) return []
  return getLibrary().filter((clip) => likedIds.has(clip.id))
}

function getSavedIds(): Set<string> {
  if (!hasAuthSession()) {
    return new Set()
  }
  ensureBookmarksHydrated()
  return bookmarkedIds
}

function makeSerializableUpload(clip: Video): StoredUpload {
  const { videoUrl, ...rest } = clip
  return rest
}

function reviveStoredUpload(stored: StoredUpload): Video {
  const safeThumbnail = resolveThumbnailUrl(stored.thumbnailUrl)
  return {
    ...stored,
    thumbnailUrl: safeThumbnail,
    videoUrl: stored.thumbnailUrl || DEFAULT_VIDEO_PLACEHOLDER,
    likesDisplay: stored.likesDisplay ?? formatLikes(stored.likes),
  }
}

function updateActiveProfile(partial: ActiveProfileUpdate): ActiveProfile {
  const previousId = getActiveUserId()
  const name = partial.name?.trim().length ? partial.name.trim() : getActiveUserName()
  const id = partial.id?.trim().toLowerCase().length ? partial.id.trim().toLowerCase() : getActiveUserId()
  const church = partial.church === undefined ? getActiveUserChurch() : partial.church?.trim() ?? ''
  const country = partial.country === undefined ? getActiveUserCountry() : partial.country?.trim() ?? ''
  const email = partial.email === undefined ? getActiveUserEmail() : partial.email?.trim().toLowerCase() ?? ''
  const photo = partial.photo === undefined ? getActiveUserPhoto() : partial.photo?.trim() ?? ''
  const isVerified = partial.isVerified === undefined ? getActiveUserVerified() : Boolean(partial.isVerified)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(ACTIVE_USER_NAME_KEY, name)
    window.localStorage.setItem(ACTIVE_USER_ID_KEY, id)
    if (church) {
      window.localStorage.setItem(ACTIVE_USER_CHURCH_KEY, church)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_CHURCH_KEY)
    }
    if (country) {
      window.localStorage.setItem(ACTIVE_USER_COUNTRY_KEY, country)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_COUNTRY_KEY)
    }
    if (photo) {
      window.localStorage.setItem(ACTIVE_USER_PHOTO_KEY, photo)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_PHOTO_KEY)
    }
    if (email) {
      window.localStorage.setItem(ACTIVE_USER_EMAIL_KEY, email)
    } else {
      window.localStorage.removeItem(ACTIVE_USER_EMAIL_KEY)
    }
  if (isVerified) {
    window.localStorage.setItem(ACTIVE_USER_VERIFIED_KEY, 'true')
  } else {
    window.localStorage.removeItem(ACTIVE_USER_VERIFIED_KEY)
  }
 }

  const profile: ActiveProfile = { id, name, church, country, email, photo, isVerified }
  syncActiveProfileAcrossLibrary(profile, previousId)
  notify()
  return profile
}

function getActiveProfile(): ActiveProfile {
  return {
    id: getActiveUserId(),
    name: getActiveUserName(),
    church: getActiveUserChurch(),
    country: getActiveUserCountry(),
    email: getActiveUserEmail(),
    photo: getActiveUserPhoto(),
    isVerified: getActiveUserVerified(),
  }
}

function signInWithDisplayName(displayName: string): ActiveProfile {
  enforceModeration(MODERATION_CONTEXT_PROFILE, [{ label: 'Display name', text: displayName }])
  const name = displayName.trim() || 'Guest Creator'
  const id = slugifyDisplayName(name)
  return updateActiveProfile({ id, name, church: null, country: null, isVerified: false })
}

function signOutToGuest(): ActiveProfile {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(ACTIVE_USER_NAME_KEY)
    window.localStorage.removeItem(ACTIVE_USER_CHURCH_KEY)
    window.localStorage.removeItem(ACTIVE_USER_COUNTRY_KEY)
    window.localStorage.removeItem(ACTIVE_USER_ID_KEY)
    window.localStorage.removeItem(ACTIVE_USER_PHOTO_KEY)
    window.localStorage.removeItem(ACTIVE_USER_EMAIL_KEY)
    window.localStorage.removeItem(ACTIVE_USER_VERIFIED_KEY)
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  }
  followedIds = new Set()
  followedHydrated = false
  followingFetchPromise = null
  return updateActiveProfile({
    id: 'guest',
    name: 'Guest Creator',
    church: null,
    country: null,
    photo: null,
    email: null,
    isVerified: false,
  })
}

function isSameUser(
  candidate: { id?: string | null; handle?: string | null; accountId?: string | null },
  profile: ActiveProfile,
  previousId?: string
): boolean {
  const value = candidate.handle || candidate.id || candidate.accountId || ''
  const normalized = normalizeHandleMatch(value)
  const normalizedActive = normalizeHandleMatch(profile.id)
  const normalizedPrev = normalizeHandleMatch(previousId || '')
  return Boolean(normalized) && (normalized === normalizedActive || (normalizedPrev && normalized === normalizedPrev))
}

function syncUserFields<
  T extends {
    id?: string | null
    handle?: string | null
    accountId?: string | null
    name?: string | null
    churchHome?: string | null
    avatar?: string | null
    photoUrl?: string | null
    church?: string | null
  }
>(user: T, profile: ActiveProfile, previousId?: string): T {
  if (!isSameUser(user, profile, previousId)) {
    return user
  }
  return {
    ...user,
    id: profile.id || user.id || undefined,
    handle: profile.id || user.handle || undefined,
    accountId: user.accountId ?? profile.id ?? undefined,
    name: profile.name || user.name || undefined,
    churchHome: profile.church ?? user.churchHome ?? user.church ?? undefined,
    church: profile.church ?? user.church ?? undefined,
    avatar: profile.photo ?? user.avatar ?? undefined,
    photoUrl: profile.photo ?? user.photoUrl ?? undefined,
  }
}

function syncActiveProfileAcrossLibrary(profile: ActiveProfile, previousId?: string) {
  const patchVideoUser = (video: Video): Video => {
    const patchedUser = syncUserFields(video.user, profile, previousId)
    if (patchedUser === video.user) return video
    return { ...video, user: patchedUser }
  }
  remoteFeed = remoteFeed.map(patchVideoUser)
  uploads = uploads.map(patchVideoUser)
}

async function createAccount(input: {
  name: string
  handle: string
  email: string
  password: string
  church?: string
  country?: string
  photo?: string | null
}): Promise<ActiveProfile> {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Display name is required')
  }
  const normalizedHandle = sanitizeHandle(input.handle)
  if (!normalizedHandle) {
    throw new Error('Handle is required')
  }
  const email = input.email.trim().toLowerCase()
  if (!email) {
    throw new Error('Email is required')
  }
  const emailCheck = verifyEmailStructure(email)
  if (!emailCheck.valid) {
    throw new Error(emailCheck.message || 'We could not verify this email address. Double-check and try again.')
  }
  const password = input.password.trim()
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }

  enforceModeration(MODERATION_CONTEXT_PROFILE, [
    { label: 'Display name', text: name },
    { label: 'Handle', text: input.handle },
    { label: 'Church / Community', text: input.church ?? '' },
    { label: 'Country', text: input.country ?? '' },
  ])

  const payload = await postJson<{ user: ApiUser; message: string; verificationUrl?: string }>('/api/auth/signup', {
    name,
    handle: normalizedHandle,
    email,
    password,
    church: input.church?.trim() || undefined,
    country: input.country?.trim() || undefined,
  })

  setStoredAuthToken(null)
  return applyApiUserSession(payload.user, null)
}

async function signInWithCredentials(email: string, password: string): Promise<ActiveProfile> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    throw new Error('Enter your email')
  }
  if (!password.trim()) {
    throw new Error('Enter your password')
  }

  const payload = await postJson<{ token: string; user: ApiUser }>('/api/auth/login', {
    email: trimmedEmail,
    password,
  })

  return applyApiUserSession(payload.user, payload.token)
}

function completeSignup(input: {
  name: string
  handle: string
  church?: string
  country?: string
  photo?: string | null
  email?: string
}): Promise<ActiveProfile> {
  return Promise.resolve().then(() => {
    const name = input.name.trim()
    if (!name) {
      throw new Error('Display name is required')
    }
    const normalizedHandle = sanitizeHandle(input.handle)
    if (!normalizedHandle) {
      throw new Error('Handle is required')
    }
    const desiredEmail = (input.email?.trim().toLowerCase() ?? getActiveUserEmail()).trim()
    if (!desiredEmail) {
      throw new Error('Email is required')
    }
    const emailCheck = verifyEmailStructure(desiredEmail)
    if (!emailCheck.valid) {
      throw new Error(emailCheck.message || 'We could not verify this email address. Double-check and try again.')
    }

    enforceModeration(MODERATION_CONTEXT_PROFILE, [
      { label: 'Display name', text: name },
      { label: 'Handle', text: input.handle },
      { label: 'Church / Community', text: input.church ?? '' },
      { label: 'Country', text: input.country ?? '' },
    ])

    return updateActiveProfile({
      id: normalizedHandle,
      name,
      church: input.church?.trim() ?? '',
      country: input.country?.trim() ?? '',
      email: desiredEmail,
      photo: input.photo ?? undefined,
      isVerified: getActiveUserVerified(),
    })
  })
}

async function verifyEmailCode(email: string, code: string): Promise<ActiveProfile> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedCode = code.trim()
  if (!trimmedEmail) {
    throw new Error('Enter your email.')
  }
  if (!trimmedCode) {
    throw new Error('Enter the verification code.')
  }
  const payload = await postJson<{ user: ApiUser; message: string }>('/api/auth/verify-email', {
    email: trimmedEmail,
    code: trimmedCode,
  })
  return applyApiUserSession(payload.user, null)
}

async function resendVerification(email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    throw new Error('Enter your email')
  }
  await postJson<{ message: string }>('/api/auth/resend-verification', { email: trimmedEmail })
}

async function requestPasswordReset(email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    throw new Error('Enter your email')
  }
  await postJson<{ message: string }>('/api/auth/forgot-password', { email: trimmedEmail })
}

async function resetPassword(token: string, password: string): Promise<ActiveProfile> {
  const trimmedToken = token.trim()
  const trimmedPassword = password.trim()
  if (!trimmedToken) {
    throw new Error('Reset link is missing or invalid.')
  }
  if (trimmedPassword.length < 6) {
    throw new Error('Password must be at least 6 characters')
  }
  const payload = await postJson<{ user: ApiUser; token: string; message: string }>('/api/auth/reset-password', {
    token: trimmedToken,
    password: trimmedPassword,
  })
  return applyApiUserSession(payload.user, payload.token)
}

async function matchContactsByEmail(emails: string[]): Promise<ContactMatch[]> {
  const normalized = emails
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
  if (!normalized.length) {
    return []
  }
  const hashes = await Promise.all(normalized.map(hashEmailForMatch))
  const payload = await postJson<{ matches: ContactMatch[] }>('/api/contacts/match', { hashes })
  return payload.matches
}

async function fetchConnectionSuggestions(limit = 4): Promise<SuggestedConnection[]> {
  if (API_BASE_URL && getStoredAuthToken()) {
    try {
      const payload = await getJson<{ suggestions: ApiSuggestedConnection[] }>(
        `/api/connections/suggested?limit=${limit}`,
        true
      )
      if (payload.suggestions?.length) {
        return payload.suggestions.map(mapApiSuggestedConnection)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Unable to fetch suggested connections from API, using local fallback.', error)
    }
  }
  return simulateNetwork(() => buildLocalSuggestions(limit))
}

function mapApiSuggestedConnection(user: ApiSuggestedConnection): SuggestedConnection {
  const summary =
    user.summary ??
    (user.church && user.country
      ? `${user.church} • ${user.country}`
      : user.church ?? user.country ?? 'Active on GodlyMe')
  return {
    id: user.id,
    handle: user.handle || user.id,
    name: user.name,
    church: user.church,
    country: user.country,
    photoUrl: user.photoUrl,
    summary,
    mutualConnections: Math.max(1, user.mutualConnections ?? 1),
  }
}

function buildLocalSuggestions(limit: number): SuggestedConnection[] {
  const activeProfile = getActiveProfile()
  const activeId = normalizeId(activeProfile.id || '')
  const following = getFollowedIds()
  const seen = new Set<string>()
  const suggestions: SuggestedConnection[] = []

  // Build a map of creators from the local library (uploads, seeds, remote feed)
  const library = getLibrary()
  const creatorsById = new Map<string, { id: string; handle: string; name: string; church?: string | null; photo?: string | null; tags: Set<string> }>()

  for (const clip of library) {
    const creator = clip.user
    const handleSource = creator.handle || creator.accountId || creator.id || (creator.name ? slugifyDisplayName(creator.name) : '')
    if (!handleSource) continue
    const normalized = normalizeId(handleSource)
    if (!normalized) continue
    const entry = creatorsById.get(normalized) || {
      id: creator.id || normalized,
      handle: handleSource,
      name: creator.name || handleSource,
      church: creator.churchHome ?? null,
      photo: creator.avatar ?? null,
      tags: new Set<string>(),
    }
    ;(clip.tags || []).forEach((t) => entry.tags.add((t || '').toLowerCase()))
    creatorsById.set(normalized, entry)
  }

  // Collect tags used by creators the active user already follows
  const followedTagSet = new Set<string>()
  for (const clip of library) {
    const creatorHandle = clip.user.handle || clip.user.accountId || clip.user.id || ''
    const normalizedCreator = normalizeId(creatorHandle)
    if (following.has(normalizedCreator)) {
      ;(clip.tags || []).forEach((t) => followedTagSet.add((t || '').toLowerCase()))
    }
  }

  // Score each candidate creator by relevance to the active user
  const scored: Array<{ score: number; candidate: SuggestedConnection }> = []
  for (const [normalized, info] of creatorsById.entries()) {
    if (!normalized || normalized === activeId || following.has(normalized) || seen.has(normalized)) continue
    seen.add(normalized)

    let score = 0
    // Higher priority if from same church
    if (info.church && activeProfile.church && info.church.trim() && info.church === activeProfile.church) {
      score += 4
    }
    // small boost for same country
    if (info.country && activeProfile.country && info.country === activeProfile.country) {
      score += 1
    }

    // tag overlap with people the user already follows
    let tagOverlap = 0
    for (const t of info.tags) {
      if (followedTagSet.has(t)) tagOverlap += 1
    }
    score += tagOverlap

    // base relevance bump if they have any tags
    if (info.tags.size > 0) score += 1

    // add a small random factor to vary suggestions a bit
    score += Math.max(0, Math.floor(Math.random() * 2))

    const mutualConnections = Math.max(1, Math.min(9, Math.round(score)))

    scored.push({
      score,
      candidate: {
        id: info.id,
        handle: info.handle,
        name: info.name,
        church: info.church ?? null,
        country: null,
        photoUrl: info.photo ?? null,
        summary: info.church || 'Active on GodlyMe',
        mutualConnections,
      },
    })
  }

  // sort by score desc
  scored.sort((a, b) => b.score - a.score)

  const results = scored.slice(0, limit).map((s) => s.candidate as SuggestedConnection)

  if (!results.length) {
    results.push({
      id: 'saintmichaels',
      handle: 'saintmichaels',
      name: 'Saint Michaels',
      church: 'Saint Michaels Cathedral',
      country: null,
      photoUrl: null,
      summary: 'Community leader',
      mutualConnections: 2,
    })
  }

  return results
}

async function hashEmailForMatch(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return ''
  }
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const encoder = new TextEncoder()
    const data = encoder.encode(normalized)
    const digest = await window.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
  }
  return hashPassword(normalized, normalized)
}

async function fetchMessageThreads(): Promise<MessageThread[]> {
  try {
    const payload = await getJson<{ threads: ApiThreadSummary[] }>('/api/messages/threads', true)
    if (!payload || !payload.threads || !Array.isArray(payload.threads)) {
      console.error('Invalid threads payload:', payload)
      return []
    }
    return payload.threads.map(mapApiThread)
  } catch (error) {
    console.error('Failed to fetch message threads:', error)
    return []
  }
}

async function fetchThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  if (!threadId) {
    return []
  }
  try {
    const payload = await getJson<{ messages: ApiThreadMessage[] }>(
      `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
      true
    )
    if (!payload || !payload.messages || !Array.isArray(payload.messages)) {
      console.error('Invalid messages payload:', payload)
      return []
    }
    return payload.messages.map(mapApiThreadMessage)
  } catch (error) {
    console.error('Failed to fetch thread messages:', error)
    return []
  }
}

async function sendThreadMessage(threadId: string, body: string): Promise<ThreadMessage> {
  if (!threadId) {
    throw new Error('Choose a conversation before sending.')
  }
  const payload = await postJson<{ message: ApiThreadMessage }>(
    `/api/messages/threads/${encodeURIComponent(threadId)}/messages`,
    { body },
    true
  )
  return mapApiThreadMessage(payload.message)
}

async function startConversationWithHandles(handles: string[], message: string, subject?: string) {
  const normalized = Array.from(
    new Set(
      handles
        .map((handle) => normalizeHandleForApi(handle))
        .filter((handle) => handle.length > 0)
    )
  )
  if (!normalized.length) {
    throw new Error('Enter at least one handle to start a conversation.')
  }
  const payload = await postJson<{ thread: ApiThreadSummary }>(
    '/api/messages/threads',
    { handles: normalized, message, subject },
    true
  )
  return mapApiThread(payload.thread)
}

type ApiMessageRequest = {
  id: string
  senderId: string
  recipientId: string
  content: string
  status: 'pending' | 'accepted' | 'declined'
  direction: 'inbound' | 'outbound'
  sender: {
    id: string
    handle: string
    name: string
    photoUrl: string | null
  }
  recipient: {
    id: string
    handle: string
    name: string
    photoUrl: string | null
  }
  createdAt: string
  updatedAt: string
}

export type MessageRequest = {
  id: string
  senderId: string
  recipientId: string
  content: string
  status: 'pending' | 'accepted' | 'declined'
  direction: 'inbound' | 'outbound'
  senderHandle: string
  senderName: string
  senderPhotoUrl: string | null
  recipientHandle: string
  recipientName: string
  recipientPhotoUrl: string | null
  createdAt: string
  updatedAt: string
}

async function fetchMessageRequests(): Promise<MessageRequest[]> {
  try {
    const payload = await getJson<{ requests: ApiMessageRequest[] }>('/api/messages/requests', true)
    if (!payload || !payload.requests || !Array.isArray(payload.requests)) {
      console.error('Invalid message requests payload:', payload)
      return []
    }
    return payload.requests.map(req => ({
      id: req.id,
      senderId: req.senderId,
      recipientId: req.recipientId,
      content: req.content,
      status: req.status,
      direction: req.direction,
      senderHandle: req.sender.handle,
      senderName: req.sender.name,
      senderPhotoUrl: req.sender.photoUrl,
      recipientHandle: req.recipient.handle,
      recipientName: req.recipient.name,
      recipientPhotoUrl: req.recipient.photoUrl,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }))
  } catch (error) {
    console.error('Failed to fetch message requests:', error)
    return []
  }
}

async function sendMessageRequest(recipientHandle: string, content: string): Promise<MessageRequest> {
  const payload = await postJson<{ request: ApiMessageRequest }>(
    '/api/messages/requests',
    { recipientHandle: normalizeHandleForApi(recipientHandle), content },
    true
  )
  const req = payload.request
  return {
    id: req.id,
    senderId: req.senderId,
    recipientId: req.recipientId,
    content: req.content,
    status: req.status,
    direction: req.direction,
    senderHandle: req.sender.handle,
    senderName: req.sender.name,
    senderPhotoUrl: req.sender.photoUrl,
    recipientHandle: req.recipient.handle,
    recipientName: req.recipient.name,
    recipientPhotoUrl: req.recipient.photoUrl,
    createdAt: req.createdAt,
    updatedAt: req.updatedAt,
  }
}

async function respondToMessageRequest(requestId: string, action: 'accept' | 'decline'): Promise<{ status: string, thread?: MessageThread }> {
  const payload = await postJson<{ status: string, thread?: ApiThreadSummary }>(
    `/api/messages/requests/${encodeURIComponent(requestId)}`,
    { action },
    true
  )
  return {
    status: payload.status,
    thread: payload.thread ? mapApiThread(payload.thread) : undefined,
  }
}

function normalizeHandleForApi(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function mapApiVideo(video: ApiFeedVideo): Video {
  const likeCount = video.stats?.likes ?? 0
  const chosenVideoUrl = (() => {
    const primary = (video.videoUrl || '').trim()
    if (isLikelyVideoAsset(primary)) return primary
    const thumbAsVideo = (video.thumbnailUrl || '').trim()
    if (isLikelyVideoAsset(thumbAsVideo)) return thumbAsVideo
    return DEFAULT_VIDEO_PLACEHOLDER
  })()
  const activeProfile = getActiveProfile()
  const user = syncUserFields(
    {
      id: video.user.handle || video.user.id,
      handle: video.user.handle ?? undefined,
      accountId: video.user.id,
      name: video.user.name || video.user.handle || video.user.id,
      churchHome: video.user.church ?? undefined,
      avatar: video.user.photoUrl ?? undefined,
      photoUrl: video.user.photoUrl ?? undefined,
    },
    activeProfile
  )
  return {
    id: video.id,
    title: video.title,
    description: video.description ?? '',
    user,
    videoUrl: chosenVideoUrl,
    thumbnailUrl: resolveThumbnailUrl(video.thumbnailUrl, video.videoUrl),
    category: (video.category as ContentCategory) || 'testimony',
    tags: video.tags ?? [],
    durationSec: video.durationSeconds ?? 0,
    likes: likeCount,
    likesDisplay: formatLikes(likeCount),
    comments: video.stats?.comments ?? 0,
    bookmarks: 0,
    shares: 0,
    donations: 0,
    publishedAt: video.createdAt,
  }
}

function mapApiNotification(notification: ApiNotificationSummary): NotificationSummary {
  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
    actor: {
      id: notification.actor.id,
      handle: notification.actor.handle ?? undefined,
      name: notification.actor.name,
      photoUrl: notification.actor.photoUrl ?? undefined,
    },
    videoId: notification.videoId ?? undefined,
    videoTitle: notification.videoTitle ?? undefined,
    commentPreview: notification.commentPreview ?? undefined,
  }
}

function mapApiComment(comment: ApiVideoComment): VideoComment {
  const user = syncUserFields(comment.user, getActiveProfile())
  return {
    id: comment.id,
    videoId: comment.videoId,
    body: comment.body,
    createdAt: comment.createdAt,
    user,
  }
}

function mapApiThreadMessage(message: ApiThreadMessage): ThreadMessage {
  const sender = syncUserFields(message.sender, getActiveProfile())
  return {
    id: message.id,
    threadId: message.threadId,
    body: message.body,
    createdAt: message.createdAt,
    sender: {
      id: sender.id,
      handle: sender.handle,
      name: sender.name,
      church: sender.church ?? undefined,
      country: sender.country ?? undefined,
      photoUrl: sender.photoUrl ?? undefined,
    },
  }
}

function mapApiThread(thread: ApiThreadSummary): MessageThread {
  return {
    id: thread.id,
    subject: thread.subject ?? undefined,
    participants: thread.participants.map((participant) => {
      const patched = syncUserFields(participant, getActiveProfile())
      return {
        id: patched.id,
        handle: patched.handle,
        name: patched.name,
        church: patched.church ?? undefined,
        country: patched.country ?? undefined,
        photoUrl: patched.photoUrl ?? undefined,
      }
    }),
    lastMessage: thread.lastMessage ? mapApiThreadMessage(thread.lastMessage) : null,
    unreadCount: thread.unreadCount ?? 0,
    updatedAt: thread.updatedAt,
  }
}

function ensureLibraryHydrated() {
  ensureUploadsHydrated()
}

function getLibrary(): Video[] {
  ensureLibraryHydrated()
  // Deduplicate by video ID to prevent showing the same video twice
  const videoMap = new Map<string, Video>()
  ;[...remoteFeed, ...uploads].forEach((video) => videoMap.set(video.id, video))
  const base = Array.from(videoMap.values())

  if (USE_SEEDS) {
    normalizedSeedVideos.forEach((video) => videoMap.set(video.id, video))
    return Array.from(videoMap.values())
  }
  return base
}

function notify() {
  listeners.forEach((listener) => listener())
}

function sortByPublishedAt(videos: Video[]): Video[] {
  return videos
    .slice()
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

function replaceRemoteFeed(videos: Video[], options: { silent?: boolean } = {}) {
  remoteFeed = sortByPublishedAt(videos)
  if (!options.silent) {
    notify()
  }
}

function mergeRemoteFeed(videos: Video[], options: { silent?: boolean } = {}) {
  if (!videos.length) {
    return
  }
  const merged = new Map(remoteFeed.map((video) => [video.id, video]))
  videos.forEach((video) => merged.set(video.id, video))
  remoteFeed = sortByPublishedAt(Array.from(merged.values()))
  if (!options.silent) {
    notify()
  }
}

function persistIfUpload(clipId: string) {
  if (uploads.find((item) => item.id === clipId)) {
    persistUploads()
  }
}

function removeClipFromFeeds(clipId: string) {
  const nextRemote = remoteFeed.filter((clip) => clip.id !== clipId)
  const nextUploads = uploads.filter((clip) => clip.id !== clipId)
  const remoteChanged = nextRemote.length !== remoteFeed.length
  const uploadsChanged = nextUploads.length !== uploads.length
  remoteFeed = nextRemote
  if (uploadsChanged) {
    uploads = nextUploads
    persistUploads()
  } else {
    uploads = nextUploads
  }
  if (remoteChanged || uploadsChanged) {
    notify()
  }
}

function filterFaithCentric(clips: Video[]): Video[] {
  return clips.filter((clip) => {
    if (!clip.tags.length) return true
    const blockedTags = ['secular', 'explicit']
    return !clip.tags.some((tag) => blockedTags.includes(tag))
  })
}

function sortForFeed(clips: Video[]): Video[] {
  return clips
    .slice()
    .sort((a, b) => {
      if (a.featured && !b.featured) return -1
      if (!a.featured && b.featured) return 1
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    })
}

export const contentService = {
  matchContactsByEmail,
  fetchConnectionSuggestions,
  fetchMessageThreads,
  fetchThreadMessages,
  sendThreadMessage,
  fetchMessageRequests,
  sendMessageRequest,
  respondToMessageRequest,
  startConversation(handles: string | string[], message: string, subject?: string) {
    const list = Array.isArray(handles) ? handles : [handles]
    return startConversationWithHandles(list, message, subject)
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  isAuthenticated() {
    return hasAuthSession() || hasProfileSession()
  },
  getActiveProfile,
  updateActiveProfile,
  completeSignup,
  createAccount,
  signInWithCredentials,
  verifyEmailCode,
  resendVerification,
  requestPasswordReset,
  resetPassword,
  signIn(displayName: string) {
    return signInWithDisplayName(displayName)
  },
  signOut() {
    setStoredAuthToken(null)
    return signOutToGuest()
  },
  async deleteAccount() {
    if (!hasAuthSession()) {
      throw new Error('Sign in to delete your account.')
    }
    await deleteJson('/api/profile/delete-account', true)
    setStoredAuthToken(null)
    return signOutToGuest()
  },
  suggestHandle(name: string) {
    return generateHandleSuggestion(name)
  },
  async followUser(userId: string) {
    const normalized = normalizeId(userId.replace(/^@/, ''))
    if (!normalized) {
      return false
    }
    if (!hasAuthSession()) {
      throw new Error('Sign in to follow creators on GodlyMe.')
    }
    await postJson(`/api/follows/${encodeURIComponent(normalized)}`, {}, true)
    ensureFollowingHydrated()
    followedIds.add(normalized)
    notify()
    return true
  },
  async unfollowUser(userId: string) {
    const normalized = normalizeId(userId.replace(/^@/, ''))
    if (!normalized) {
      return false
    }
    if (!hasAuthSession()) {
      throw new Error('Sign in to manage who you follow.')
    }
    await deleteJson(`/api/follows/${encodeURIComponent(normalized)}`, true)
    ensureFollowingHydrated()
    if (followedIds.has(normalized)) {
      followedIds.delete(normalized)
      notify()
    }
    return false
  },
  isFollowing(userId: string) {
    if (!hasAuthSession()) {
      return false
    }
    ensureFollowingHydrated()
    return followedIds.has(normalizeId(userId))
  },
  toggleFollow(userId: string) {
    const normalized = normalizeId(userId.replace(/^@/, ''))
    if (followedIds.has(normalized)) {
      return this.unfollowUser(userId).then(() => false)
    }
    return this.followUser(userId).then(() => true)
  },
  listFollowingIds(): string[] {
    if (!hasAuthSession()) {
      return []
    }
    return [...getFollowedIds()]
  },
  isBookmarked(clipId: string) {
    if (!hasAuthSession()) {
      return false
    }
    ensureBookmarksHydrated()
    return bookmarkedIds.has(clipId)
  },
  listSavedClipIds(): string[] {
    return [...getSavedIds()]
  },
  getSavedClips(): Video[] {
    if (!hasAuthSession()) {
      return []
    }
    const savedIds = getSavedIds()
    if (!savedIds.size) return []
    return getLibrary().filter((clip) => savedIds.has(clip.id))
  },
  toggleBookmark(clipId: string) {
    if (!hasAuthSession()) {
      throw new Error('Sign in to save videos for later.')
    }
    ensureBookmarksHydrated()
    const clip = getLibrary().find((item) => item.id === clipId)
    if (bookmarkedIds.has(clipId)) {
      bookmarkedIds.delete(clipId)
      if (clip && clip.bookmarks) {
        clip.bookmarks = Math.max(0, clip.bookmarks - 1)
      }
    } else {
      bookmarkedIds.add(clipId)
      if (clip) {
        clip.bookmarks = (clip.bookmarks ?? 0) + 1
      }
    }
    persistBookmarks()
    if (clip) {
      persistIfUpload(clipId)
    }
    notify()
    return bookmarkedIds.has(clipId)
  },
  async search(query: string, limit = 20) {
    const trimmed = (query || '').trim()
    if (!trimmed) return { accounts: [], videos: [], categories: [] }
    if (API_BASE_URL) {
      try {
        const payload = await postJson<any>(`/api/search`, { q: trimmed, limit }, false)
        if (payload && typeof payload === 'object' && ('accounts' in payload || 'videos' in payload || 'categories' in payload)) {
          return payload
        }
      } catch (error) {
        console.error('Search API error:', error)
        // Fall through to local search on error
      }
    }
    const local = await searchLocal(trimmed, limit)
    const hasRemote = remoteFeed && remoteFeed.length > 0
    if (!hasRemote && !local.accounts.length && !local.videos.length && !local.categories.length) {
      try {
        await contentService.fetchForYouFeed()
      } catch {
        // ignore
      }
      return await searchLocal(trimmed, limit)
    }
    return local
  },
  async fetchForYouFeed(): Promise<Video[]> {
    try {
      const payload = await getJson<{ videos: ApiFeedVideo[] }>('/api/feed/for-you')
      const mapped = payload.videos.map(mapApiVideo)
      replaceRemoteFeed(mapped, { silent: true })
      return mapped
    } catch {
      const fallback = USE_SEEDS ? sortForFeed(filterFaithCentric(normalizedSeedVideos)) : []
      replaceRemoteFeed(fallback, { silent: true })
      return fallback
    }
  },
  async fetchFollowingFeed(): Promise<Video[]> {
    try {
      const payload = await getJson<{ videos: ApiFeedVideo[] }>('/api/feed/following', true)
      const mapped = payload.videos.map(mapApiVideo)
      replaceRemoteFeed(mapped, { silent: true })
      return mapped
    } catch (error) {
      if ((error as any)?.status === 401) {
        return []
      }
      throw error
    }
  },
  async fetchMyUploads(): Promise<Video[]> {
    const payload = await getJson<{ videos: ApiFeedVideo[] }>('/api/feed/mine', true)
    const mapped = payload.videos.map(mapApiVideo)
    mergeRemoteFeed(mapped, { silent: true })
    return mapped
  },
  async fetchFollowerProfiles(): Promise<ApiUser[]> {
    if (!hasAuthSession()) {
      return []
    }
    const payload = await getJson<{ followers: ApiUser[] }>('/api/follows/followers', true)
    return payload.followers
  },
  async fetchFollowingProfiles(): Promise<ApiUser[]> {
    if (!hasAuthSession()) {
      return []
    }
    const payload = await getJson<{ following: ApiUser[] }>('/api/follows/following', true)
    return payload.following
  },
  async fetchCreatorUploads(profileId: string): Promise<Video[]> {
    const normalized = normalizeHandleMatch(profileId)
    if (!normalized) {
      return []
    }
    const payload = await getJson<{ videos: ApiFeedVideo[] }>(`/api/feed/profiles/${encodeURIComponent(normalized)}`)
    const mapped = payload.videos.map(mapApiVideo)
    mergeRemoteFeed(mapped, { silent: true })
    return mapped
  },
  async fetchNotifications(): Promise<NotificationSummary[]> {
    if (!hasAuthSession()) {
      throw new Error('Sign in to view your notifications.')
    }
    const payload = await getJson<{ notifications: ApiNotificationSummary[] }>('/api/notifications', true)
    return payload.notifications.map(mapApiNotification)
  },
  async fetchFollowStats(profileId: string): Promise<FollowStats> {
    const trimmed = profileId.trim()
    if (!trimmed) {
      throw new Error('Profile handle is required.')
    }
    const normalized = normalizeHandleMatch(trimmed)
    const identifier = normalized || trimmed
    return getJson<FollowStats>(`/api/follows/profiles/${encodeURIComponent(identifier)}/stats`)
  },
  async fetchCollectionFeed(collection: ContentCollection): Promise<Video[]> {
    const curated = filterFaithCentric(getLibrary().filter((clip) => clip.collection === collection))
    return sortForFeed(curated)
  },
  getGuides(): VesselGuide[] {
    return curatedGuides
  },
  getClipById(id: string): Video | undefined {
    return getLibrary().find((clip) => clip.id === id)
  },
  async createUpload(input: {
    title: string
    description?: string
    file?: File
    category?: ContentCategory
    tags?: string[]
  }): Promise<Video> {
    const activeProfile = getActiveProfile()
    const normalizedId = normalizeId(activeProfile.id || '')
    const normalizedName = (activeProfile.name || '').trim().toLowerCase()
    const isGuestProfile = normalizedId === 'guest' || normalizedName === 'guest creator' || !activeProfile.email
    if (isGuestProfile) {
      throw new Error('Sign in to your GodlyMe profile before uploading a video.')
    }
    enforceModeration(MODERATION_CONTEXT_UPLOAD, [
      { label: 'Title', text: input.title },
      { label: 'Description', text: input.description ?? '' },
    ])

    // If file is provided, upload via FormData
    if (input.file) {
      const formData = new FormData()
      formData.append('title', input.title.trim())
      if (input.description) formData.append('description', input.description)
      if (input.category) formData.append('category', input.category)
      if (input.tags && input.tags.length > 0) formData.append('tags', JSON.stringify(input.tags))
      formData.append('video', input.file)

      // Generate thumbnail from video
      try {
        const thumbnailBlob = await generateVideoThumbnail(input.file)
        if (thumbnailBlob) {
          formData.append('thumbnail', thumbnailBlob, 'thumbnail.jpg')
        }
      } catch (err) {
        console.warn('Failed to generate thumbnail, continuing without it:', err)
      }

      const payload = await requestJson<{ video: ApiFeedVideo }>(
        '/api/feed/videos',
        {
          method: 'POST',
          body: formData,
        },
        true
      )
      const clip = mapApiVideo(payload.video)
      mergeRemoteFeed([clip])
      return clip
    }

    // Otherwise send as JSON with placeholder URLs
    const uploadData = {
      title: input.title.trim(),
      description: input.description || undefined,
      category: input.category || undefined,
      tags: input.tags || undefined,
      videoUrl: DEFAULT_VIDEO_PLACEHOLDER,
      thumbnailUrl: DEFAULT_THUMB_PLACEHOLDER,
    }

    const payload = await postJson<{ video: ApiFeedVideo }>(
      '/api/feed/videos',
      uploadData,
      true
    )
    const clip = mapApiVideo(payload.video)
    mergeRemoteFeed([clip])
    return clip
  },
  async deleteUpload(clipId: string) {
    requireVerifiedSession('delete videos')
    const trimmed = clipId.trim()
    if (!trimmed) {
      throw new Error('Select a video to delete.')
    }
    await deleteJson(`/api/feed/videos/${encodeURIComponent(trimmed)}`, true)
    removeClipFromFeeds(trimmed)
  },
  async recordLike(clipId: string): Promise<{ liked: boolean; count: number }> {
    requireVerifiedSession('like videos')
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) {
      throw new Error('Video not found.')
    }
    const likerId = getActiveProfile().id || getActiveUserId()
    const likedIds = getLikedIdsForUser(likerId)
    const alreadyLiked = likedIds.has(clipId)
    let nextCount = clip.likes

    if (alreadyLiked) {
      try {
        const payload = await deleteJson(`/api/videos/${encodeURIComponent(clipId)}/like`, true).catch(() => null)
        if (payload && typeof (payload as any).count === 'number') {
          nextCount = (payload as any).count
        } else {
          nextCount = Math.max(0, clip.likes - 1)
        }
      } finally {
        removeLikeForUser(likerId, clipId)
      }
    } else {
      const payload = await postJson<{ count?: number }>(`/api/videos/${encodeURIComponent(clipId)}/like`, {}, true)
      if (payload && typeof payload.count === 'number') {
        nextCount = payload.count
      } else {
        nextCount = clip.likes + 1
      }
      addLikeForUser(likerId, clipId)
    }

    clip.likes = nextCount
    clip.likesDisplay = formatLikes(nextCount)
    persistIfUpload(clipId)
    notify()
    return { liked: !alreadyLiked, count: nextCount }
  },
  async fetchClipComments(clipId: string): Promise<VideoComment[]> {
    const trimmedId = clipId.trim()
    if (!trimmedId) {
      return []
    }
    try {
      const payload = await getJson<{ comments: ApiVideoComment[] }>(
        `/api/videos/${encodeURIComponent(trimmedId)}/comments`,
        false
      )
      // Check if payload and comments array exist
      if (!payload || !payload.comments || !Array.isArray(payload.comments)) {
        console.error('Invalid comments response:', payload)
        return []
      }
      return payload.comments.map(mapApiComment)
    } catch (error) {
      console.error('Error fetching comments:', error)
      return []
    }
  },
  async recordComment(clipId: string, body: string): Promise<VideoComment> {
    requireVerifiedSession('comment on videos')
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) {
      throw new Error('Video not found.')
    }
    const trimmed = body.trim()
    if (!trimmed) {
      throw new Error('Share something meaningful before posting.')
    }
    const payload = await postJson<{ comment: ApiVideoComment }>(
      `/api/videos/${encodeURIComponent(clipId)}/comments`,
      { content: trimmed },
      true
    )
    clip.comments = (clip.comments ?? 0) + 1
    persistIfUpload(clipId)
    notify()
    return mapApiComment(payload.comment)
  },
  recordShare(clipId: string) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return
    clip.shares = (clip.shares ?? 0) + 1
    persistIfUpload(clipId)
    notify()
  },
  recordDonation(clipId: string, amount = 1) {
    const clip = getLibrary().find((item) => item.id === clipId)
    if (!clip) return
    clip.donations = (clip.donations ?? 0) + amount
    persistIfUpload(clipId)
    notify()
  },
  getClipsByAuthor(authorId: string): Video[] {
    const trimmed = authorId.trim()
    const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed
    const targetHandle = normalizeHandleMatch(withoutAt)
    const slugTarget = normalizeId(withoutAt)
    return getLibrary().filter((clip) => {
      const clipHandle = clip.user.handle ? normalizeHandleMatch(clip.user.handle) : ''
      const clipId = clip.user.id ? normalizeHandleMatch(clip.user.id) : ''
      const clipAccountId = clip.user.accountId ? normalizeHandleMatch(clip.user.accountId) : ''
      const normalizedName = normalizeId(clip.user.name)
      const handleMatches =
        (targetHandle && clipHandle === targetHandle) ||
        (targetHandle && clipId === targetHandle) ||
        (targetHandle && clipAccountId === targetHandle)
      if (handleMatches) {
        return true
      }
      return clipId === slugTarget || clipAccountId === slugTarget || normalizedName === slugTarget
    })
  },
  getLikedFeedFor(userId: string): Video[] {
    if (!hasAuthSession()) return []
    const normalizedTarget = normalizeId(userId)
    const activeId = normalizeId(getActiveProfile().id || '')
    if (normalizedTarget && activeId && normalizedTarget !== activeId) {
      return []
    }
    const likedIds = getLikedIdsForUser(normalizedTarget || activeId || 'guest')
    if (!likedIds.size) return []
    return getLibrary().filter((clip) => likedIds.has(clip.id))
  },
  isLiked(clipId: string) {
    if (!hasAuthSession()) return false
    const likerId = getActiveProfile().id || getActiveUserId()
    return getLikedIdsForUser(likerId).has(clipId)
  },
}

export type {
  Video,
  ContentCategory,
  ContentCollection,
  ActiveProfile,
  ApiUser,
  ContactMatch,
  SuggestedConnection,
  MessageThread,
  ThreadMessage,
  VideoComment,
  NotificationSummary,
  FollowStats,
}
