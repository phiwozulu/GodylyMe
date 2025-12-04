import React from "react"
import { useNavigate } from "react-router-dom"
import VideoCard from "../shared/VideoCard"
import { contentService, type Video } from "../services/contentService"
import { formatLikes } from "../services/mockData"
import { CommentSheet, DonateSheet } from "../shared/VideoSheets"
import styles from "./Following.module.css"

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

export default function Following() {
  const [clips, setClips] = React.useState<Video[]>([])
  const [loading, setLoading] = React.useState(true)
  const [index, setIndex] = React.useState(0)
  const [followLoading, setFollowLoading] = React.useState<string | null>(null)
  const [commentClip, setCommentClip] = React.useState<Video | null>(null)
  const [donateClip, setDonateClip] = React.useState<Video | null>(null)
  const [updateTrigger, setUpdateTrigger] = React.useState(0)
  const navigate = useNavigate()
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const rafRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let mounted = true
    let pollInterval: NodeJS.Timeout | null = null

    async function load() {
      const data = await contentService.fetchFollowingFeed()
      if (mounted) {
        const currentUser = contentService.getActiveProfile()
        // Filter out user's own videos from Following feed
        const filtered = data.filter((clip) => {
          const userId = resolveUserId(clip)
          return currentUser.id !== userId && currentUser.id !== clip.user.id
        })
        setClips(filtered)
        setLoading(false)
      }
    }

    async function pollForNewContent() {
      if (!mounted) return
      try {
        const data = await contentService.fetchFollowingFeed()
        if (mounted && data.length) {
          const currentUser = contentService.getActiveProfile()
          const filtered = data.filter((clip) => {
            const userId = resolveUserId(clip)
            return currentUser.id !== userId && currentUser.id !== clip.user.id
          })
          setClips((current) => {
            // Only add new videos that aren't already in the feed
            const existingIds = new Set(current.map(v => v.id))
            const newVideos = filtered.filter(v => !existingIds.has(v.id))
            if (newVideos.length > 0) {
              // Add new videos to the end of the feed
              return [...current, ...newVideos]
            }
            return current
          })
        }
      } catch (err) {
        // Silently fail on polling errors
        console.debug('Poll failed:', err)
      }
    }

    // Initial
    load()
<<<<<<< Updated upstream
    const unsubscribe = contentService.subscribe(() => {
      // Trigger immediate re-render for bookmark/like changes
      setUpdateTrigger(prev => prev + 1)
      // Also reload feed data
      load()
    })
=======
    const unsubscribe = contentService.subscribe(load)
>>>>>>> Stashed changes

    // Poll for new content every 30 seconds
    pollInterval = setInterval(pollForNewContent, 30000)

    return () => {
      mounted = false
      if (pollInterval) clearInterval(pollInterval)
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
  }, [clips.length])

  const scrollTo = React.useCallback(
    (target: number) => {
      const node = trackRef.current
      if (!node) return
      const clampTarget = Math.max(0, Math.min(target, clips.length - 1))
      node.scrollTo({ top: clampTarget * node.clientHeight, behavior: 'smooth' })
    },
    [clips.length]
  )

  const handleScroll = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = window.requestAnimationFrame(() => {
      const node = trackRef.current
      if (!node) return
      const next = Math.round(node.scrollTop / node.clientHeight)
      if (next !== index && next >= 0 && next < clips.length) {
        setIndex(next)
      }
    })
  }, [clips.length, index])

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
    return (
      <div className={styles.loading}>
        Checking the ministries you follow...
      </div>
    )
  }

  if (!clips.length) {
    return (
      <div className={styles.emptyState}>
        <h3>No updates just yet</h3>
        <p>
          Start following creators whose voices encourage you. Explore the For You tab to discover worship leaders,
          teachers, and everyday believers sharing the hope of Jesus.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={styles.viewport}>
        <div className={styles.track} ref={trackRef} onScroll={handleScroll} onKeyDown={handleKey} tabIndex={0}>
          {clips.map((clip, clipIndex) => {
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
                    if (navigator && 'share' in navigator) {
                      navigator.share({ title: clip.title, url: shareUrl }).catch(() => {
                        window.open(shareUrl, '_blank')
                      })
                    } else if (navigator?.clipboard) {
                      navigator.clipboard.writeText(shareUrl).catch(() => {
                        window.open(shareUrl, '_blank')
                      })
                    }
                  }}
                  onDonate={() => setDonateClip(clip)}
                  onFollow={isOwnVideo ? undefined : () => handleFollowAction(clip)}
                  followBusy={busy}
                  isBookmarked={contentService.isBookmarked(clip.id)}
                  isLiked={contentService.isLiked(clip.id)}
                  isFollowing={isFollowingCreator}
                  onAuthorClick={openProfile}
                  isActive={isActive}
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
              const data = await contentService.fetchFollowingFeed()
              const currentUser = contentService.getActiveProfile()
              // Filter out user's own videos from Following feed
              const filtered = data.filter((clip) => {
                const userId = resolveUserId(clip)
                return currentUser.id !== userId && currentUser.id !== clip.user.id
              })
              setClips(filtered)
              setUpdateTrigger(prev => prev + 1)
            } catch (err) {
              // Ignore errors, keep existing data
              console.error('Failed to refresh feed:', err)
              setUpdateTrigger(prev => prev + 1)
            }
          }}
        />
      ) : null}
      {donateClip ? <DonateSheet clip={donateClip} onClose={() => setDonateClip(null)} /> : null}
    </>
  )
}
