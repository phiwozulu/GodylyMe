import React from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  contentService,
  type Video,
  type ActiveProfile,
  type ApiUser,
  type FollowStats,
  THUMBNAIL_PLACEHOLDER,
} from "../services/contentService"
import { formatLikes } from "../services/mockData"
import { SvgBack, SvgShare, SvgVerified } from "../shared/icons"
import styles from "./Profile.module.css"

type TabKey = "videos" | "liked" | "saved"

type OverlayEntry = {
  id: string
  label: string
  route: string
  subtitle?: string | null
}

type OverlayProps = {
  title: string
  entries: OverlayEntry[]
  onSelect: (route: string) => void
  onClose: () => void
}

const normalize = (value?: string) => (value || "").toLowerCase()

type AuthMode = "signup" | "login"

export default function Profile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeProfile, setActiveProfile] = React.useState<ActiveProfile>(() => contentService.getActiveProfile())
  const targetId = id === "me" ? activeProfile.id : id || ""
  const [isAuthenticated, setIsAuthenticated] = React.useState(contentService.isAuthenticated())

  const [clips, setClips] = React.useState<Video[]>([])
  const [likedClips, setLikedClips] = React.useState<Video[]>([])
  const [savedClips, setSavedClips] = React.useState<Video[]>(() => contentService.getSavedClips())
  const [isFollowing, setIsFollowing] = React.useState(false)
  const [tab, setTab] = React.useState<TabKey>("videos")
  const [showFollowingList, setShowFollowingList] = React.useState(false)
  const [showFollowersList, setShowFollowersList] = React.useState(false)
  const [followBusy, setFollowBusy] = React.useState(false)
  const [followStats, setFollowStats] = React.useState<FollowStats | null>(null)
  const [viewerFollowers, setViewerFollowers] = React.useState<ApiUser[]>([])
  const [viewerFollowing, setViewerFollowing] = React.useState<ApiUser[]>([])
  const [followVersion, setFollowVersion] = React.useState(0)

  React.useEffect(() => {
    const unsubscribe = contentService.subscribe(() => {
      setActiveProfile(contentService.getActiveProfile())
      setIsAuthenticated(contentService.isAuthenticated())
      setFollowVersion((value) => value + 1)
    })
    return unsubscribe
  }, [])

  React.useEffect(() => {
    setTab("videos")
  }, [targetId])
  const heroClip = clips[0] ?? likedClips[0]

  const normalizedTargetId = normalize(targetId)
  const normalizedActiveId = normalize(activeProfile.id)
  const isSelf = normalizedTargetId === normalizedActiveId && normalizedTargetId.length > 0
  const isGuest = isSelf && !isAuthenticated

  const displayName = isSelf
    ? activeProfile.name || "Guest Creator"
    : heroClip?.user.name || (targetId ? targetId : "Creator")
  const defaultHandleSeed = targetId || normalize(displayName).replace(/\s+/g, "")
  const profileHandle = isSelf
    ? `@${activeProfile.id || "guest"}`
    : heroClip?.user.id
    ? `@${heroClip.user.id}`
    : `@${defaultHandleSeed}`

  const followTargetId = isSelf ? "" : heroClip?.user.id ?? targetId

  const openSettings = React.useCallback(
    (mode?: AuthMode) => {
      const search = mode ? `?mode=${mode}` : ""
      navigate(`/profile/me/settings${search}`)
    },
    [navigate]
  )

  const goBack = React.useCallback(() => {
    navigate(-1)
  }, [navigate])

  const headerLeftAction = isSelf
    ? null
    : { label: "Go back", icon: <SvgBack width={22} height={22} />, onClick: goBack }

  const headerRightAction = isSelf
    ? { label: "Open profile settings", icon: "\u2699", onClick: () => openSettings() }
    : { label: "Copy profile link", icon: <SvgShare width={22} height={22} />, onClick: copyProfileLink }

  React.useEffect(() => { 
    if (!targetId) return
    const refresh = () => {
      setClips(contentService.getClipsByAuthor(targetId))
      setLikedClips(contentService.getLikedFeedFor(targetId))
      if (isSelf) {
        setSavedClips(contentService.getSavedClips())
      } else {
        setSavedClips([])
      }
    }
    refresh()
    const unsubscribe = contentService.subscribe(refresh)
    return unsubscribe
  }, [targetId, isSelf])

  React.useEffect(() => {
    let cancelled = false
    async function loadProfileVideos() {
      if (!targetId) {
        setClips([])
        return
      }
      try {
        const data = isSelf
          ? await contentService.fetchMyUploads()
          : await contentService.fetchCreatorUploads(targetId)
        if (!cancelled) {
          setClips(data)
        }
      } catch (error) {
        console.error('Failed to load profile feed', error)
        if (!cancelled) {
          setClips(contentService.getClipsByAuthor(targetId))
        }
      }
    }
    void loadProfileVideos()
    return () => {
      cancelled = true
    }
  }, [targetId, isSelf])

  React.useEffect(() => {
    let cancelled = false
    if (!targetId) {
      setFollowStats(null)
      return () => {
        cancelled = true
      }
    }
    contentService
      .fetchFollowStats(targetId)
      .then((stats) => {
        if (!cancelled) {
          setFollowStats(stats)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFollowStats(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [targetId])

  React.useEffect(() => {
    if (!followTargetId) return
    setIsFollowing(contentService.isFollowing(followTargetId))
  }, [followTargetId])

  React.useEffect(() => {
    setFollowBusy(false)
  }, [followTargetId])
  React.useEffect(() => {
    if (isGuest) {
      setShowFollowersList(false)
      setShowFollowingList(false)
    }
  }, [isGuest])
  React.useEffect(() => {
    let cancelled = false

    async function loadFollowData() {
      if (!isAuthenticated) {
        if (!cancelled) {
          setViewerFollowers([])
          setViewerFollowing([])
        }
        return
      }
      try {
        const [followingList, followerList] = await Promise.all([
          contentService.fetchFollowingProfiles(),
          contentService.fetchFollowerProfiles(),
        ])
        if (!cancelled) {
          setViewerFollowing(followingList)
          setViewerFollowers(followerList)
        }
      } catch (error) {
        console.error('Failed to load follow lists', error)
        if (!cancelled) {
          setViewerFollowing([])
          setViewerFollowers([])
        }
      }
    }

    void loadFollowData()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, followVersion])

  if (!targetId) {
    return <div className={styles.placeholder}>Creator not found.</div>
  }

  const totalLikes = clips.reduce((acc, clip) => acc + clip.likes, 0)
  const savedCount = savedClips.length
  const church = isSelf ? activeProfile.church : heroClip?.user.churchHome || ""
  const avatarPhoto = isSelf ? activeProfile.photo : undefined
  const avatarLetter = displayName.slice(0, 1).toUpperCase()
  const selfFollowers = isSelf ? viewerFollowers : []
  const selfFollowing = isSelf ? viewerFollowing : []
  const targetHandle = heroClip?.user.handle || (targetId.startsWith('@') ? targetId.slice(1) : '')
  const canMessageTarget = Boolean(!isSelf && isAuthenticated && targetHandle && isFollowing)

  const ensureHandle = React.useCallback((value: string) => (value.startsWith("@") ? value : `@${value}`), [])

  const followingEntries = React.useMemo<OverlayEntry[]>(() => {
    if (isGuest || !isSelf) return []
    return selfFollowing
      .map((user) => {
        const handle = user.handle?.trim()
        if (!handle) {
          return null
        }
        return {
          id: user.id,
          label: ensureHandle(handle),
          route: `/profile/${handle}`,
          subtitle: user.name ?? null,
        }
      })
      .filter((entry): entry is OverlayEntry => Boolean(entry))
  }, [ensureHandle, selfFollowing, isGuest, isSelf])

  const followersEntries = React.useMemo<OverlayEntry[]>(() => {
    if (isGuest || !isSelf) return []
    return selfFollowers
      .map((user) => {
        const handle = user.handle?.trim()
        if (!handle) {
          return null
        }
        return {
          id: user.id,
          label: ensureHandle(handle),
          route: `/profile/${handle}`,
          subtitle: user.name ?? null,
        }
      })
      .filter((entry): entry is OverlayEntry => Boolean(entry))
  }, [ensureHandle, selfFollowers, isGuest, isSelf])

  const gridSource = React.useMemo(() => {
    if (tab === 'videos') return clips
    if (tab === 'liked') return likedClips
    return savedClips
  }, [tab, clips, likedClips, savedClips])

  const watchState = React.useMemo(
    () => ({
      context: {
        type: 'profile' as const,
        ids: gridSource.map((clip) => clip.id),
        authorId: targetId,
      },
    }),
    [gridSource, targetId]
  )

  const fallbackFollowingCount = isSelf ? followingEntries.length : 0
  const fallbackFollowerCount = isSelf ? followersEntries.length : 0
  const followingCount = followStats?.following ?? fallbackFollowingCount
  const followerCount = followStats?.followers ?? fallbackFollowerCount
  const canShowFollowLists = isSelf && isAuthenticated

  const handleFollowToggle = React.useCallback(async () => {
    if (!followTargetId || followBusy) return
    if (!isAuthenticated) {
      window.alert('Sign in to follow creators on Vessel.')
      return
    }
    setFollowBusy(true)
    try {
      if (isFollowing) {
        await contentService.unfollowUser(followTargetId)
        setIsFollowing(false)
      } else {
        await contentService.followUser(followTargetId)
        setIsFollowing(true)
      }
      if (targetId) {
        const stats = await contentService.fetchFollowStats(targetId)
        setFollowStats(stats)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update follow status. Please try again.'
      window.alert(message)
    } finally {
      setFollowBusy(false)
    }
  }, [followBusy, followTargetId, isFollowing, isAuthenticated, targetId])
  const handleMessageClick = React.useCallback(() => {
    if (!targetHandle) {
      window.alert('This creator has not finished setting up messaging yet.')
      return
    }
    if (!canMessageTarget) {
      window.alert('Follow this creator to start messaging on Godlyme.')
      return
    }
    navigate(`/inbox?compose=${encodeURIComponent(targetHandle)}`)
  }, [canMessageTarget, navigate, targetHandle])

  const handleGridKey = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, clipId: string, state?: { context: unknown }) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        navigate(`/watch/${clipId}`, { state })
      }
    },
    [navigate]
  )

  const handleRemoveSavedClip = React.useCallback((clip: Video) => {
    try {
      contentService.toggleBookmark(clip.id)
      setSavedClips((current) => current.filter((item) => item.id !== clip.id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update saved videos right now.'
      window.alert(message)
    }
  }, [])

  const handleDeleteClip = React.useCallback(
    async (clip: Video) => {
      const confirmed = window.confirm(`Delete "${clip.title}" from GodlyMe?`)
      if (!confirmed) return
      try {
        await contentService.deleteUpload(clip.id)
        setClips((current) => current.filter((item) => item.id !== clip.id))
        setSavedClips((current) => current.filter((item) => item.id !== clip.id))
        setLikedClips((current) => current.filter((item) => item.id !== clip.id))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to delete that video right now.'
        window.alert(message)
      }
    },
    []
  )

  function copyProfileLink() {
    const shareId = targetId || activeProfile.id
    const url = `${window.location.origin}/profile/${shareId || "me"}`
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url).then(() => window.alert('Profile link copied'))
    } else {
      window.open(url, '_blank')
    }
  }

  return (
    <div className={styles.profile}>
      <div className={styles.profileCard}>
        <header className={styles.topBar}>
          {headerLeftAction ? (
            <button
              type="button"
              className={styles.headerButton}
              onClick={headerLeftAction.onClick}
              aria-label={headerLeftAction.label}
            >
              {headerLeftAction.icon}
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            className={styles.headerButton}
            onClick={headerRightAction.onClick}
            aria-label={headerRightAction.label}
          >
            {typeof headerRightAction.icon === 'string' ? (
              <span aria-hidden="true">{headerRightAction.icon}</span>
            ) : (
              headerRightAction.icon
            )}
          </button>
        </header>

        <section className={styles.hero}>
          <div className={styles.banner}>
            <div className={styles.avatar}>
              {avatarPhoto ? <img src={avatarPhoto} alt={`${displayName} avatar`} /> : avatarLetter}
            </div>
          </div>
          <div className={styles.bio}>
            <span className={styles.handle}>{profileHandle}</span>
            <div className={styles.displayNameRow}>
              <h1 className={styles.displayName}>{displayName}</h1>
              {isSelf && activeProfile.isVerified ? (
                <SvgVerified width={20} height={20} className={styles.verifiedBadge} />
              ) : null}
            </div>
            {church ? <p className={styles.church}>{church}</p> : null}
          </div>
          <div className={styles.statsRow}>
            <Stat
              label="Following"
              value={followingCount.toLocaleString()}
              onClick={canShowFollowLists && followingCount ? () => setShowFollowingList(true) : undefined}
              disabled={!canShowFollowLists || !followingCount}
            />
            <Stat
              label="Followers"
              value={followerCount.toLocaleString()}
              onClick={canShowFollowLists && followerCount ? () => setShowFollowersList(true) : undefined}
              disabled={!canShowFollowLists || !followerCount}
            />
            <Stat label="Likes" value={formatLikes(totalLikes)} />
            {isSelf ? <Stat label="Saved" value={savedCount.toLocaleString()} /> : null}
          </div>
          <div className={styles.actions}>
            {isGuest ? (
              <>
                <button
                  className={`${styles.actionButton} ${styles.primaryAction}`}
                  onClick={() => openSettings("signup")}
                >
                  Create profile
                </button>
                <button className={styles.actionButton} onClick={() => openSettings("login")}>
                  Sign in
                </button>
              </>
            ) : isSelf ? (
              <>
                <button className={`${styles.actionButton} ${styles.primaryAction}`} onClick={() => navigate('/upload')}>
                  Upload
                </button>
                <button className={styles.actionButton} onClick={() => openSettings("signup")}>
                  Edit profile
                </button>
                <button className={styles.actionButton} onClick={copyProfileLink}>
                  Share
                </button>
              </>
            ) : (
              <>
                <button
                  className={`${styles.actionButton} ${styles.primaryAction}`}
                  onClick={handleFollowToggle}
                  disabled={followBusy}
                  aria-busy={followBusy}
                >
                  {followBusy ? (isFollowing ? 'Unfollowing...' : 'Following...') : isFollowing ? 'Following' : 'Follow'}
                </button>
                <button
                  className={styles.actionButton}
                  onClick={handleMessageClick}
                  disabled={!canMessageTarget}
                  title={canMessageTarget ? 'Send a message' : 'Follow this creator to start messaging'}
                >
                  Message
                </button>
                <button className={styles.actionButton} onClick={copyProfileLink}>
                  Share
                </button>
              </>
            )}
          </div>
        </section>

        <section className={styles.gridSection}>
          <div className={styles.tabBar}>
            <button
              type="button"
              className={tab === 'videos' ? styles.tabActive : styles.tabButton}
              onClick={() => setTab('videos')}
            >
              Videos
            </button>
            <button
              type="button"
              className={tab === 'liked' ? styles.tabActive : styles.tabButton}
              onClick={() => setTab('liked')}
            >
              Liked
            </button>
            {isSelf ? (
              <button
                type="button"
                className={tab === 'saved' ? styles.tabActive : styles.tabButton}
                onClick={() => setTab('saved')}
              >
                Saved
              </button>
            ) : null}
          </div>
          <div className={`${styles.gridContent} ${tab === 'videos' ? styles.gridContentVideos : ''}`}>
            {gridSource.map((clip) => {
              const allowDelete = isSelf && tab === 'videos'
              const allowUnsave = isSelf && tab === 'saved'
              return (
                <div
                  key={`${tab}-${clip.id}`}
                  role="button"
                  tabIndex={0}
                  className={styles.gridItem}
                  onClick={() => navigate(`/watch/${clip.id}`, { state: watchState })}
                  onKeyDown={(event) => handleGridKey(event, clip.id, watchState)}
                  aria-label={`Open ${clip.title}`}
                >
                  <img
                    className={styles.gridThumb}
                    src={clip.thumbnailUrl || THUMBNAIL_PLACEHOLDER}
                    alt={clip.title}
                    loading="lazy"
                  />
                  <div className={styles.gridOverlay}>
                    <span>Likes: {formatLikes(clip.likes)}</span>
                  </div>
                  {allowDelete || allowUnsave ? (
                    <div className={styles.gridActions}>
                      {allowDelete ? (
                        <button
                          type="button"
                          className={styles.gridActionButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteClip(clip)
                          }}
                        >
                          Delete
                        </button>
                      ) : null}
                      {allowUnsave ? (
                        <button
                          type="button"
                          className={styles.gridActionButton}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleRemoveSavedClip(clip)
                          }}
                        >
                          Unsave
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {tab === 'videos' && !clips.length ? (
              <div className={styles.emptyVideos}>
                <h3>No videos yet</h3>
                <p>When this creator uploads, their moments will appear here.</p>
              </div>
            ) : null}
            {tab === 'liked' && !likedClips.length ? (
              <div className={styles.emptyLiked}>
                <h3>No liked videos yet</h3>
                <p>Videos you like will appear here. Explore the feed and tap the heart to save your favourites.</p>
              </div>
            ) : null}
            {tab === 'saved' && !savedClips.length ? (
              <div className={styles.emptyLiked}>
                <h3>No saved videos yet</h3>
                <p>Tap Save on any Godly Me moment to keep it close for future encouragement.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {showFollowingList && canShowFollowLists ? (
        <Overlay
          title="Following"
          entries={followingEntries}
          onSelect={(route) => {
            setShowFollowingList(false)
            navigate(route)
          }}
          onClose={() => setShowFollowingList(false)}
        />
      ) : null}
      {showFollowersList && canShowFollowLists ? (
        <Overlay
          title="Followers"
          entries={followersEntries}
          onSelect={(route) => {
            setShowFollowersList(false)
            navigate(route)
          }}
          onClose={() => setShowFollowersList(false)}
        />
      ) : null}
    </div>
  )
}

function Stat({
  label,
  value,
  onClick,
  disabled = false,
}: {
  label: string
  value: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className={styles.stat} onClick={onClick} disabled={disabled}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </button>
  )
}

function Overlay({ title, entries, onSelect, onClose }: OverlayProps) {
  return (
    <div className={styles.overlayBackdrop}>
      <div className={styles.overlayPanel}>
        <div className={styles.overlayHeader}>
          <h3 className={styles.overlayTitle}>{title}</h3>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        <ul className={styles.overlayList}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <button type="button" className={styles.overlayItem} onClick={() => onSelect(entry.route)}>
                <div className={styles.overlayAvatar}>{entry.label.slice(1, 2).toUpperCase()}</div>
                <div>
                  <div className={styles.overlayHandle}>{entry.label}</div>
                  <div className={styles.overlayMeta}>{entry.subtitle || 'Faith-filled creator'}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
