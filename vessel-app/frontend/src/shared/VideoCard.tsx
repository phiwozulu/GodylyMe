import React from "react"
import { formatLikes } from "../services/mockData"
import { type Video, THUMBNAIL_PLACEHOLDER, VIDEO_PLACEHOLDER } from "../services/contentService"
import styles from "./VideoCard.module.css"
import { DonateIcon, ShareIcon, ProvidedLikeIcon, PlayIcon, PauseIcon } from "./icons"
import { SvgBookmark, SvgComments, SvgVolume, SvgMute } from "./icons"

type Props = {
  video: Video
  isBookmarked?: boolean
  isLiked?: boolean
  isFollowing?: boolean
  isActive?: boolean
  onLike?: (clip: Video) => void
  onComment?: (clip: Video) => void
  onBookmark?: (clip: Video) => void
  onShare?: (clip: Video) => void
  onDonate?: (clip: Video) => void
  onFollow?: (clip: Video) => void
  onAuthorClick?: (clip: Video) => void
  followBusy?: boolean
}

export default function VideoCard({
  video,
  isBookmarked = false,
  isLiked = false,
  isFollowing = false,
  isActive = false,
  onLike,
  onComment,
  onBookmark,
  onShare,
  onDonate,
  onFollow,
  onAuthorClick,
  followBusy = false,
}: Props) {
  const likes = video.likesDisplay ?? formatLikes(video.likes)
  const scripture = video.scripture
  const tags = video.tags.slice(0, 3)
  const baseHandle = video.user.handle || video.user.id || ''
  const normalizedHandle =
    baseHandle.replace(/^@/, '').replace(/\s+/g, '').toLowerCase() || slugify(video.user.name)
  const handle = `@${normalizedHandle}`
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [videoSrc, setVideoSrc] = React.useState(() => safeVideoSrc(video.videoUrl))
  const [muted, setMuted] = React.useState(false)
  const [userPaused, setUserPaused] = React.useState(false)
  const [expandDescription, setExpandDescription] = React.useState(false)
  const DESCRIPTION_PREVIEW_LIMIT = 20
  const posterUrl = React.useMemo(
    () => resolvePosterUrl(video.thumbnailUrl, video.videoUrl),
    [video.thumbnailUrl, video.videoUrl]
  )
  React.useEffect(() => {
    setVideoSrc(safeVideoSrc(video.videoUrl))
  }, [video.videoUrl])
  React.useEffect(() => {
    setExpandDescription(false)
    setMuted(false)
  }, [video.id])
  const descriptionText = video.description ?? ""
  const shouldClampDescription = descriptionText.length > DESCRIPTION_PREVIEW_LIMIT
  const displayDescription =
    expandDescription || !shouldClampDescription
      ? descriptionText
      : `${descriptionText.slice(0, DESCRIPTION_PREVIEW_LIMIT).trimEnd()}...`

  React.useEffect(() => {
    const node = videoRef.current
    if (!node) return
    const shouldMute = muted || !isActive
    node.muted = shouldMute
    node.volume = shouldMute ? 0 : 1

    if (isActive) {
      if (!userPaused) {
        const playPromise = node.play()
        if (!shouldMute && playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            node.muted = true
            setMuted(true)
          })
        }
      } else {
        // user has paused this clip; ensure it stays paused until they resume
        node.pause()
      }
    } else {
      node.pause()
      try {
        node.currentTime = 0
      } catch {
        // ignore reset failures on certain browsers
      }
    }
  }, [isActive, muted, userPaused])


  // When user explicitly toggles play/pause, we set `userPaused` so autoplay won't resume unexpectedly
  const togglePlayPause = React.useCallback(() => {
    const node = videoRef.current
    if (!node) return
    if (node.paused) {
      node.play().catch(() => {
        // if play fails, fallback to muting and retry
        node.muted = true
        node.play().catch(() => undefined)
      })
      setUserPaused(false)
    } else {
      node.pause()
      setUserPaused(true)
    }
  }, [])

  const toggleMute = React.useCallback(() => {
    setMuted((value) => !value)
  }, [])

  const soundLabel = "Sound"
  const soundCount = muted || !isActive ? "Off" : "On"

  const actions: Array<{
    key: string
    icon: React.ReactNode
    count: string
    label: string
    onClick?: (clip: Video) => void
    active?: boolean
    ariaPressed?: boolean
  }> = [
    // Play / Pause control
    (() => {
      const isPaused = userPaused || (videoRef.current ? videoRef.current.paused : true)
      return {
        key: "play",
        icon: isPaused ? <PlayIcon width={22} height={22} /> : <PauseIcon width={22} height={22} />,
        count: "",
        label: isPaused ? "Play" : "Pause",
        onClick: () => togglePlayPause(),
        active: !isPaused,
        ariaPressed: !isPaused,
      }
    })(),
    {
      key: "sound",
      icon: muted || !isActive ? <SvgMute width={22} height={22} /> : <SvgVolume width={22} height={22} />,
      count: soundCount,
      label: soundLabel,
      onClick: () => toggleMute(),
      active: !muted && isActive,
      ariaPressed: !muted && isActive,
    },
    {
      key: "like",
      icon: <ProvidedLikeIcon width={22} height={22} />,
      count: likes,
      label: isLiked ? "Liked" : "Likes",
      onClick: onLike,
      active: isLiked,
      ariaPressed: isLiked,
    },
    {
      key: "comment",
      icon: <SvgComments width={22} height={22} />,
      count: formatCount(video.comments ?? 0),
      label: "Comments",
      onClick: onComment,
    },
    {
      key: "save",
      icon: <SvgBookmark width={22} height={22} />,
      count: formatCount(video.bookmarks ?? 0),
      label: isBookmarked ? "Saved" : "Save",
      onClick: onBookmark,
      active: isBookmarked,
    },
    {
      key: "donate",
      icon: <DonateIcon width={22} height={22} />,
      count: formatCount(video.donations ?? 0),
      label: "Donate",
      onClick: onDonate,
    },
    {
      key: "share",
      icon: <ShareIcon width={22} height={22} />,
      count: formatCount(video.shares ?? 0),
      label: "Share",
      onClick: onShare,
    },
  ]

  return (
    <article className={styles.card}>
      {videoSrc ? (
        <video
          ref={videoRef}
          className={styles.video}
          src={videoSrc}
          poster={posterUrl}
          autoPlay
          loop
          muted={muted || !isActive}
          playsInline
          onError={() => setVideoSrc("")}
        />
      ) : (
        <div
          className={styles.fallbackImage}
          style={{ backgroundImage: `url(${posterUrl || THUMBNAIL_PLACEHOLDER})` }}
          aria-hidden="true"
        />
      )}
      <div className={styles.overlay}>
        <div className={styles.topMeta}>
          <button
            type="button"
            className={styles.avatar}
            onClick={() => onAuthorClick?.(video)}
            aria-label={`Open profile for ${video.user.name}`}
          >
            {video.user.name.slice(0, 1).toUpperCase()}
          </button>
          <button type="button" className={styles.profileInfo} onClick={() => onAuthorClick?.(video)}>
            <span className={styles.handle}>{handle}</span>
            {video.user.churchHome && <span className={styles.church}>{video.user.churchHome}</span>}
          </button>
          {onFollow && !isFollowing ? (
            <button
              type="button"
              className={styles.followButton}
              onClick={() => onFollow(video)}
              disabled={followBusy}
              aria-busy={followBusy}
            >
              {followBusy ? "Following..." : "Follow"}
            </button>
          ) : null}
        </div>
        <span className={styles.category}>{video.category}</span>
        <h3 className={styles.title}>{video.title}</h3>
        {descriptionText ? (
          <div className={styles.descriptionBlock}>
            <p className={styles.description}>{displayDescription}</p>
            {shouldClampDescription ? (
              <button
                type="button"
                className={styles.descriptionToggle}
                onClick={() => setExpandDescription((value) => !value)}
              >
                {expandDescription ? "See less" : "See more"}
              </button>
            ) : null}
          </div>
        ) : null}
        {scripture ? (
          <div className={styles.scripture}>
            {scripture.book} {scripture.chapter}:{scripture.verses}
          </div>
        ) : null}
        {tags.length ? (
          <div className={styles.tagRow}>
            {tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.actions}>
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            data-key={action.key}
            className={`${styles.actionButton} ${action.active ? styles.actionButtonActive : ""}`}
            onClick={() => action.onClick?.(video)}
            aria-label={`${action.label} for ${video.title}`}
            aria-pressed={action.ariaPressed}
          >
            <span className={styles.actionIcon} aria-hidden="true">
              {action.icon}
            </span>
            <span className={styles.actionCount}>{action.count}</span>
          </button>
        ))}
      </div>
      <span className={styles.duration}>{formatDuration(video.durationSec)}</span>
    </article>
  )
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "creator"
  )
}

function formatDuration(totalSeconds: number) {
  if (!totalSeconds) return "Live"
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function formatCount(value: number) {
  if (!value) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return `${value}`
}

function resolvePosterUrl(thumbnailUrl?: string, videoUrl?: string) {
  const candidate = (thumbnailUrl || "").trim()
  if (candidate && !isVideoAsset(candidate)) {
    return candidate
  }
  const fallback = (videoUrl || "").trim()
  if (fallback && !isVideoAsset(fallback)) {
    return fallback
  }
  return THUMBNAIL_PLACEHOLDER
}

function safeVideoSrc(candidate?: string) {
  const trimmed = (candidate || "").trim()
  if (trimmed && isVideoAsset(trimmed)) {
    return trimmed
  }
  return ""
}

function isVideoAsset(url: string) {
  try {
    const parsed = new URL(url, "https://placeholder.vessel")
    const sanitized = parsed.pathname.split("?")[0] || ""
    return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(sanitized)
  } catch {
    return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(url)
  }
}
