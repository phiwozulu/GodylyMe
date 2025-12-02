import React from "react"
import { useNavigate } from "react-router-dom"
import VideoCard from "../shared/VideoCard"
import { contentService, type Video } from "../services/contentService"
import { Media } from "../media"
import { formatLikes } from "../services/mockData"
import { CommentSheet, DonateSheet } from "../shared/VideoSheets"
import styles from "./ForYou.module.css"

type Props = {
  filter?: (clip: Video) => boolean
  refreshKey?: number
}

const offlineClip: Video = {
  id: "offline-demo",
  title: "We're reconnecting — enjoy this preview clip",
  description: "This sample video shows while we reconnect to the server. Once the backend is up, your feed will appear here.",
  user: {
    id: "preview-channel",
    handle: "preview",
    name: "Preview Channel",
    churchHome: "GodlyMe",
  },
  // Offline placeholder uses the logo animation video served from /public
  videoUrl: "/media/logo-video/logo%20animation1.mp4",
  thumbnailUrl: "/media/logo-video/GodlyMe-Loading.gif",
  category: "testimony",
  tags: ["faith", "hope", "inspiration"],
  durationSec: 62,
  likes: 0,
  likesDisplay: "0",
  comments: 0,
  bookmarks: 0,
  donations: 0,
  shares: 0,
  publishedAt: new Date().toISOString(),
}

const normalizeProfileTarget = (video: Video): string => {
  const candidate = (video.user.handle || video.user.id || "").trim()
  if (candidate) return candidate
  const fallback = video.user.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return fallback || "creator"
}

const resolveUserId = (clip: Video): string => clip.user.handle || clip.user.id || normalizeProfileTarget(clip)

export default function ForYou({ filter, refreshKey }: Props) {
  const [clips, setClips] = React.useState<Video[]>([])
  const [loading, setLoading] = React.useState(true)
  const [index, setIndex] = React.useState(0)
  const [followLoading, setFollowLoading] = React.useState<string | null>(null)
  const [commentClip, setCommentClip] = React.useState<Video | null>(null)
  const [donateClip, setDonateClip] = React.useState<Video | null>(null)
  const navigate = useNavigate()
  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const rafRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let mounted = true

    async function loadFeed() {
      const data = await contentService.fetchForYouFeed()
      const next = data.length ? data : [offlineClip]
      if (mounted) {
        setClips(next)
        setLoading(false)
      }
    }

    loadFeed()
    const unsubscribe = contentService.subscribe(loadFeed)

    return () => {
      mounted = false
      unsubscribe()
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (typeof refreshKey === 'undefined') {
      return
    }
    let cancelled = false
    setLoading(true)
    contentService
      .fetchForYouFeed()
      .then((data) => {
        if (cancelled) return
        const next = data.length ? data : [offlineClip]
        setClips(next)
        setLoading(false)
        setIndex(0)
        const node = trackRef.current
        if (node) {
          node.scrollTo({ top: 0, behavior: 'smooth' })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const visibleClips = React.useMemo(() => {
    if (!filter) return clips
    return clips.filter(filter)
  }, [clips, filter])

  const locked = visibleClips.length <= 1

  React.useEffect(() => {
    setIndex(0)
    const node = trackRef.current
    if (node) {
      node.scrollTo({ top: 0 })
    }
  }, [visibleClips.length])

  const scrollTo = React.useCallback(
    (target: number) => {
      const node = trackRef.current
      if (!node) return
      const clampTarget = Math.max(0, Math.min(target, visibleClips.length - 1))
      node.scrollTo({ top: clampTarget * node.clientHeight, behavior: "smooth" })
    },
    [visibleClips.length]
  )

  const handleScroll = React.useCallback(() => {
    if (locked) return
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = window.requestAnimationFrame(() => {
      const node = trackRef.current
      if (!node) return
      const next = Math.round(node.scrollTop / node.clientHeight)
      if (next !== index && next >= 0 && next < visibleClips.length) {
        setIndex(next)
      }
    })
  }, [index, visibleClips.length])

  const handleKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown") {
        event.preventDefault()
        scrollTo(index + 1)
      } else if (event.key === "ArrowUp") {
        event.preventDefault()
        scrollTo(index - 1)
      }
    },
    [index, scrollTo]
  )

  const handleWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (locked) {
        event.preventDefault()
        event.stopPropagation()
        const node = trackRef.current
        if (node && node.scrollTop !== 0) {
          node.scrollTo({ top: 0 })
        }
      }
    },
    [locked]
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
        const message = err instanceof Error ? err.message : "Unable to update follow status. Please try again."
        window.alert(message)
      } finally {
        setFollowLoading((current) => (current === targetId ? null : current))
      }
    },
    []
  )

  const handleBookmark = React.useCallback((clipId: string) => {
    try {
      contentService.toggleBookmark(clipId)
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We could not register that like. Please try again.'
      window.alert(message)
    }
  }, [])

  const openProfile = React.useCallback(
    (clip: Video) => {
      const target = normalizeProfileTarget(clip)
      navigate(`/profile/${target}`)
    },
    [navigate]
  )

  if (loading) {
    return (
      <div className={styles.loading}>
        Curating today's devotionals...
      </div>
    )
  }

  if (!visibleClips.length) {
    return (
      <div className={styles.empty}>
        Nothing to show here yet. Check back soon for new Godly Me moments.
      </div>
    )
  }

  return (
    <>
      <div className={styles.viewport}>
        <div
          className={locked ? `${styles.track} ${styles.trackLocked}` : styles.track}
          ref={trackRef}
          onScroll={handleScroll}
          onKeyDown={handleKey}
          onWheel={handleWheel}
          tabIndex={locked ? -1 : 0}
        >
          {visibleClips.map((clip, clipIndex) => {
            const userId = resolveUserId(clip)
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
                  onDonate={() => setDonateClip(clip)}
                  onFollow={() => handleFollowAction(clip)}
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
      {commentClip ? <CommentSheet clip={commentClip} onClose={() => setCommentClip(null)} /> : null}
      {donateClip ? <DonateSheet clip={donateClip} onClose={() => setDonateClip(null)} /> : null}
    </>
  )
}
