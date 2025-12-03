import React from 'react'
import { useNavigate } from 'react-router-dom'
import VideoCard from '../shared/VideoCard'
import { contentService, type Video, type ApiUser } from '../services/contentService'
import { formatLikes } from '../services/mockData'
import { CommentSheet, DonateSheet } from '../shared/VideoSheets'
import styles from './Following.module.css'

const normalizeProfileTarget = (video: Video): string => {
  const candidate = (video.user.handle || video.user.id || '').trim()
  if (candidate) return candidate
  const fallback = video.user.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return fallback || 'creator'
}

const resolveUserId = (clip: Video): string => clip.user.handle || clip.user.id || normalizeProfileTarget(clip)

export default function Friends() {
  const [clips, setClips] = React.useState<Video[]>([])
  const [loading, setLoading] = React.useState(true)
  const [needsAuth, setNeedsAuth] = React.useState(false)
  const [index, setIndex] = React.useState(0)
  const [followLoading, setFollowLoading] = React.useState<string | null>(null)
  const [commentClip, setCommentClip] = React.useState<Video | null>(null)
  const [donateClip, setDonateClip] = React.useState<Video | null>(null)
  const [mutualAccounts, setMutualAccounts] = React.useState<Set<string>>(new Set())
  const [mutualHandles, setMutualHandles] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)
  const [updateTrigger, setUpdateTrigger] = React.useState(0)
  const navigate = useNavigate()
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const rafRef = React.useRef<number | null>(null)

  const filteredClips = React.useMemo(() => {
    if (!mutualAccounts.size && !mutualHandles.size) return []
    const currentUser = contentService.getActiveProfile()
    return clips.filter((clip) => {
      const accountId = normalizeValue(clip.user.accountId || clip.user.id)
      const handle = normalizeHandle(clip.user.handle || clip.user.id)
      const userId = resolveUserId(clip)
      // Filter out user's own videos and only include mutual connections
      const isOwnVideo = currentUser.id === userId || currentUser.id === clip.user.id
      const isMutual = (accountId && mutualAccounts.has(accountId)) || (handle && mutualHandles.has(handle))
      return !isOwnVideo && isMutual
    })
  }, [clips, mutualAccounts, mutualHandles])

  React.useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setError(null)
        if (!contentService.isAuthenticated()) {
          if (!mounted) return
          setNeedsAuth(true)
          setClips([])
          setLoading(false)
          return
        }
        const [followingProfiles, followerProfiles, followingFeed] = await Promise.all([
          contentService.fetchFollowingProfiles(),
          contentService.fetchFollowerProfiles(),
          contentService.fetchFollowingFeed(),
        ])
        if (!mounted) return
        setNeedsAuth(false)
        setMutualAccounts(buildMutualAccountSet(followingProfiles ?? [], followerProfiles ?? []))
        setMutualHandles(buildMutualHandleSet(followingProfiles ?? [], followerProfiles ?? []))
        setClips(followingFeed ?? [])
      } catch (err) {
        if (!mounted) return
        const message = err instanceof Error ? err.message : 'Unable to load friends feed.'
        setError(message)
        setClips([])
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()
    const unsubscribe = contentService.subscribe(() => {
      // Trigger immediate re-render for bookmark/like changes
      setUpdateTrigger(prev => prev + 1)
      // Also reload feed data
      load()
    })
    return () => {
      mounted = false
      unsubscribe()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    setIndex(0)
    const node = trackRef.current
    if (node) {
      node.scrollTo({ top: 0 })
    }
  }, [filteredClips.length])

  const scrollTo = React.useCallback(
    (target: number) => {
      const node = trackRef.current
      if (!node) return
      const clampTarget = Math.max(0, Math.min(target, filteredClips.length - 1))
      node.scrollTo({ top: clampTarget * node.clientHeight, behavior: 'smooth' })
    },
    [filteredClips.length]
  )

  const handleScroll = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = window.requestAnimationFrame(() => {
      const node = trackRef.current
      if (!node) return
      const next = Math.round(node.scrollTop / node.clientHeight)
      if (next !== index && next >= 0 && next < filteredClips.length) {
        setIndex(next)
      }
    })
  }, [filteredClips.length, index])

  const handleKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        scrollTo(index + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        scrollTo(index - 1)
      }
    },
    [index, scrollTo]
  )

  const openProfile = React.useCallback(
    (clip: Video) => {
      const target = normalizeProfileTarget(clip)
      navigate(`/profile/${target}`)
    },
    [navigate]
  )

  const handleFollowAction = React.useCallback(
    async (clip: Video) => {
      const targetId = resolveUserId(clip)
      setFollowLoading(targetId)
      try {
        if (contentService.isFollowing(targetId)) {
          await contentService.unfollowUser(targetId)
        } else {
          await contentService.followUser(targetId)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to update follow status. Please try again.'
        window.alert(message)
      } finally {
        setFollowLoading((current) => (current === targetId ? null : current))
      }
    },
    []
  )

  const handleBookmark = React.useCallback((clipId: string) => {
    try {
      const isBookmarked = contentService.toggleBookmark(clipId)
      // Update local state immediately for responsive UI
      setClips((current) =>
        current.map((clip) =>
          clip.id === clipId
            ? { ...clip, bookmarks: isBookmarked ? (clip.bookmarks ?? 0) + 1 : Math.max(0, (clip.bookmarks ?? 0) - 1) }
            : clip
        )
      )
      setUpdateTrigger(prev => prev + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in to save videos for later.'
      window.alert(message)
    }
  }, [])

  const handleLike = React.useCallback(async (clipId: string) => {
    try {
      const result = await contentService.recordLike(clipId)
      setClips((current) =>
        current.map((clip) =>
          clip.id === clipId ? { ...clip, likes: result.count, likesDisplay: formatLikes(result.count) } : clip
        )
      )
      setUpdateTrigger(prev => prev + 1)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not register that like. Please try again.'
      window.alert(message)
    }
  }, [])

  if (loading) {
    return <div className={styles.loading}>Gathering your friends' updates...</div>
  }

  if (needsAuth) {
    return <div className={styles.empty}>Sign in to view friends-only clips.</div>
  }

  if (error) {
    return <div className={styles.empty}>{error}</div>
  }

  if (!filteredClips.length) {
    return (
      <div className={styles.empty}>
        Only mutual followers appear here. Follow people who follow you back to populate this feed.
      </div>
    )
  }

  return (
    <>
      <div className={styles.viewport}>
        <div className={styles.track} ref={trackRef} onScroll={handleScroll} onKeyDown={handleKey} tabIndex={0}>
          {filteredClips.map((clip, clipIndex) => {
            const userId = resolveUserId(clip)
            const currentUser = contentService.getActiveProfile()
            const isOwnVideo = currentUser.id === userId || currentUser.id === clip.user.id
            const isFollowingCreator = contentService.isFollowing(userId)
            const busy = followLoading === userId
            const isActive = clipIndex === index
            return (
              <section key={clip.id} className={styles.slide}>
                <VideoCard
                  video={clip}
                  onLike={() => handleLike(clip.id)}
                  onComment={() => setCommentClip(clip)}
                  onBookmark={() => handleBookmark(clip.id)}
                  onShare={() => {
                    contentService.recordShare(clip.id)
                    const shareUrl =
                      typeof window !== 'undefined' ? `${window.location.origin}/watch/${clip.id}` : `/watch/${clip.id}`
                    if (typeof navigator !== 'undefined' && 'share' in navigator) {
                      navigator.share({ title: clip.title, url: shareUrl }).catch(() => {
                        window.open(shareUrl, '_blank')
                      })
                    } else if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
                      navigator.clipboard.writeText(shareUrl).catch(() => {
                        window.open(shareUrl, '_blank')
                      })
                    }
                  }}
                  onFollow={isOwnVideo ? undefined : () => handleFollowAction(clip)}
                  onDonate={() => setDonateClip(clip)}
                  onAuthorClick={() => openProfile(clip)}
                  isFollowing={isFollowingCreator}
                  isBookmarked={contentService.isBookmarked(clip.id)}
                  followBusy={busy}
                  isActive={isActive}
                  isLiked={contentService.isLiked(clip.id)}
                />
              </section>
            )
          })}
        </div>
      </div>
      {commentClip ? (
        <CommentSheet
          clip={commentClip}
          onClose={async () => {
            setCommentClip(null)
            // Refetch feed to get updated counts
            try {
              const [followingProfiles, followerProfiles, followingFeed] = await Promise.all([
                contentService.fetchFollowingProfiles(),
                contentService.fetchFollowerProfiles(),
                contentService.fetchFollowingFeed(),
              ])
              setMutualAccounts(buildMutualAccountSet(followingProfiles ?? [], followerProfiles ?? []))
              setMutualHandles(buildMutualHandleSet(followingProfiles ?? [], followerProfiles ?? []))
              setClips(followingFeed ?? [])
            } catch (err) {
              // Ignore errors, keep existing data
            }
            setUpdateTrigger(prev => prev + 1)
          }}
        />
      ) : null}
      {donateClip ? <DonateSheet clip={donateClip} onClose={() => setDonateClip(null)} /> : null}
    </>
  )
}

function normalizeValue(value?: string | null): string {
  return (value || '').trim().toLowerCase()
}

function normalizeHandle(value?: string | null): string {
  if (!value) return ''
  return value.trim().replace(/^@/, '').toLowerCase()
}

function buildMutualAccountSet(following: ApiUser[], followers: ApiUser[]): Set<string> {
  const followerIds = new Set(followers.map((user) => normalizeValue(user.id)))
  const intersection = new Set<string>()
  following.forEach((user) => {
    const normalized = normalizeValue(user.id)
    if (normalized && followerIds.has(normalized)) {
      intersection.add(normalized)
    }
  })
  return intersection
}

function buildMutualHandleSet(following: ApiUser[], followers: ApiUser[]): Set<string> {
  const followerHandles = new Set(followers.map((user) => normalizeHandle(user.handle || user.id)))
  const intersection = new Set<string>()
  following.forEach((user) => {
    const normalized = normalizeHandle(user.handle || user.id)
    if (normalized && followerHandles.has(normalized)) {
      intersection.add(normalized)
    }
  })
  return intersection
}
