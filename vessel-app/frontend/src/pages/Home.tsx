import React from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { contentService, type Video, type VideoComment, type ApiUser } from '../services/contentService'
import { formatLikes } from '../services/mockData'
import { formatRelativeTime } from '../utils/time'
import { Media } from '../media'
import styles from './Home.module.css'

type TabId = 'forYou' | 'following' | 'friends' | 'prayer'
type SearchResults = {
  accounts: Array<{
    id: string
    handle?: string | null
    name?: string | null
    church?: string | null
    photoUrl?: string | null
  }>
  videos: Video[]
  categories: string[]
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
  { id: 'forYou', label: 'For You' },
  { id: 'prayer', label: 'Prayer' },
]
const FALLBACK_BACKDROP =
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80'

export default function Home() {
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const [featured, setFeatured] = React.useState<Video[]>([])
  const [comments, setComments] = React.useState<VideoComment[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  const [commentsError, setCommentsError] = React.useState<string | null>(null)
  const [commentBusy, setCommentBusy] = React.useState(false)
  const [commentText, setCommentText] = React.useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const initialQuery = (searchParams.get('q') || '').trim()
  const [searchValue, setSearchValue] = React.useState(initialQuery)
  const [showResults, setShowResults] = React.useState(Boolean(initialQuery))
  const [searchResults, setSearchResults] = React.useState<SearchResults>({ accounts: [], videos: [], categories: [] })
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)
  const [isCommentsOpen, setIsCommentsOpen] = React.useState(false)
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabId>('forYou')
  const isPrayer = activeTab === 'prayer'

  React.useEffect(() => {
    let cancelled = false
    async function loadFeed() {
      if (activeTab === 'prayer') {
        setFeatured([])
        return
      }

      try {
        let feed: Video[] = []
        if (activeTab === 'following') {
          feed = await contentService.fetchFollowingFeed()
        } else if (activeTab === 'friends') {
          const [followingList, followerList] = await Promise.all([
            contentService.fetchFollowingProfiles().catch(() => []),
            contentService.fetchFollowerProfiles().catch(() => []),
          ])
          const mutualAccountIds = buildMutualAccountSet(followingList, followerList)
          const mutualHandles = buildMutualHandleSet(followingList, followerList)
          const baseFeed = await contentService.fetchFollowingFeed()
          feed = baseFeed.filter((clip) => {
            const id = normalizeValue(clip.user.accountId || clip.user.id)
            const handle = normalizeHandle(clip.user.handle || clip.user.id)
            return (id && mutualAccountIds.has(id)) || (handle && mutualHandles.has(handle))
          })
        } else {
          feed = await contentService.fetchForYouFeed()
        }
        if (!cancelled) {
          setFeatured(feed)
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err)
          setFeatured([])
        }
      } finally {
        if (!cancelled) {
        }
      }
    }
    void loadFeed()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  React.useEffect(() => {
    if (isPrayer) {
      setIsCommentsOpen(false)
    }
  }, [isPrayer])

  const heroVideo = featured[0] ?? null
  const heroBackground = heroVideo?.thumbnailUrl || FALLBACK_BACKDROP

  React.useEffect(() => {
    if (!isCommentsOpen || !heroVideo) {
      return
    }
    let cancelled = false
    setCommentsLoading(true)
    setCommentsError(null)
    contentService
      .fetchClipComments(heroVideo.id)
      .then((data) => {
        if (!cancelled) {
          setComments(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load comments.'
          setCommentsError(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCommentsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [heroVideo, isCommentsOpen])

  React.useEffect(() => {
    if (!initialQuery) return
    setIsSearchOpen(true)
    setShowResults(true)
  }, [initialQuery])

  React.useEffect(() => {
    const trimmed = searchValue.trim()
    if (!trimmed) {
      setSearchResults({ accounts: [], videos: [], categories: [] })
      setSearchError(null)
      setSearchLoading(false)
      return
    }
    let cancelled = false
    setSearchLoading(true)
    setSearchError(null)
    contentService
      .search(trimmed, 20)
      .then((result: Partial<SearchResults> | null) => {
        if (cancelled) return
        setSearchResults({
          accounts: result?.accounts ?? [],
          videos: result?.videos ?? [],
          categories: result?.categories ?? [],
        })
      })
      .catch((err) => {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Unable to search right now.'
        setSearchError(message)
        setSearchResults({ accounts: [], videos: [], categories: [] })
      })
      .finally(() => {
        if (!cancelled) {
          setSearchLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [searchValue])

  const likesDisplay = heroVideo?.likesDisplay ?? formatLikes(heroVideo?.likes ?? 0)
  const commentsDisplay = formatLikes(heroVideo?.comments ?? comments.length)
  const savesDisplay = formatLikes(heroVideo?.bookmarks ?? 0)

  return (
    <div className={`${styles.home} ${isPrayer ? styles.prayerMode : ''}`}>
      {!isPrayer ? (
        <>
          <div className={styles.backdrop} style={{ backgroundImage: `url(${heroBackground})` }} />
          <div className={styles.backdropOverlay} />
        </>
      ) : null}

      <div className={styles.screen}>
        <div className={styles.headerRow}>
          <div className={styles.tabHeader}>
            <div className={styles.tabLogo}>
              <img src={Media.icons.logo} alt="Godlyme" />
            </div>
            <div className={styles.tabGroup}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={`${styles.searchButton} ${isPrayer ? styles.prayerSearchButton : ''}`}
            onClick={() => {
              setShowResults(true)
              setIsSearchOpen(true)
              setTimeout(() => searchInputRef.current?.focus(), 10)
            }}
          >
            Search
          </button>
        </div>

        {isSearchOpen ? (
          <div className={styles.searchOverlay} role="dialog" aria-modal="true">
            <div className={styles.searchModal}>
              <form
                className={styles.searchBar}
                onSubmit={(event) => {
                  event.preventDefault()
                  setShowResults(true)
                  const trimmed = searchValue.trim()
                  const nextParams = new URLSearchParams(searchParams)
                  if (trimmed) {
                    nextParams.set('q', trimmed)
                  } else {
                    nextParams.delete('q')
                  }
                  setSearchParams(nextParams)
                }}
              >
                <span aria-hidden="true">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search creators, churches, videos..."
                  onFocus={() => setShowResults(true)}
                />
                {searchValue ? (
                  <button type="button" aria-label="Clear search" onClick={() => setSearchValue('')}>
                    ✕
                  </button>
                ) : null}
                <button type="submit" className={styles.searchSubmit}>
                  Search
                </button>
                <button
                  type="button"
                  className={styles.searchClose}
                  aria-label="Close search"
                  onClick={() => setIsSearchOpen(false)}
                >
                  Close
                </button>
              </form>
              {searchValue && showResults ? (
                <div className={styles.inlineResults}>
                  {searchLoading ? (
                    <p>Gathering the latest moments...</p>
                  ) : searchError ? (
                    <p className={styles.searchError}>{searchError}</p>
                  ) : (
                    <>
                      <div className={styles.resultGroup}>
                        <div className={styles.resultHeader}>
                          <span>Accounts</span>
                          <small>{searchResults.accounts.length} found</small>
                        </div>
                        {searchResults.accounts.length ? (
                          searchResults.accounts.slice(0, 5).map((user) => (
                            <Link key={user.id} to={`/profile/${user.handle || user.id}`} className={styles.resultItem}>
                              <div className={styles.resultMeta}>
                                <strong>@{user.handle || user.id}</strong>
                                <span>{user.name || user.handle || user.id}</span>
                              </div>
                            </Link>
                          ))
                        ) : (
                          <p className={styles.resultEmpty}>No matching accounts yet.</p>
                        )}
                      </div>
                      <div className={styles.resultGroup}>
                        <div className={styles.resultHeader}>
                          <span>Videos</span>
                          <small>{searchResults.videos.length} found</small>
                        </div>
                        {searchResults.videos.length ? (
                          searchResults.videos.slice(0, 5).map((clip) => (
                          <Link
                            key={clip.id}
                            to={`/watch/${clip.id}`}
                            state={{
                              context: {
                                type: 'search',
                                ids: searchResults.videos.map((video) => video.id),
                                query: searchValue,
                              },
                            }}
                            className={styles.resultItem}
                          >
                              <div className={styles.resultMeta}>
                                <strong>{clip.title}</strong>
                                <span>{clip.user.name}</span>
                              </div>
                            </Link>
                          ))
                        ) : (
                          <p className={styles.resultEmpty}>No matching clips yet.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isPrayer ? (
          <div className={styles.prayerLayout}>
            <div className={`${styles.prayerCard} ${styles.prayerCardDark}`}>
              <span className={styles.prayerLabel}>Prayer feed</span>
              <h2 className={styles.prayerTitle}>This feature is coming soon</h2>
              <p className={styles.prayerText}>
                We are crafting a dedicated space for prayer requests, live intercession, and community encouragement.
                Thanks for journeying with us while it is built.
              </p>
            </div>

            <div className={`${styles.prayerCard} ${styles.prayerCardLight}`}>
              <div className={styles.prayerLabelRow}>
                <span className={styles.prayerLabel}>Support the build</span>
                <span className={styles.prayerPill}>Building together</span>
              </div>
              <h2 className={styles.prayerTitle}>Donate to help this app grow faster</h2>
              <p className={styles.prayerText}>
                Your gift helps us launch prayer rooms, real-time requests, and guided devotion tools sooner for the
                whole community.
              </p>
              <div className={styles.prayerActions}>
                <button type="button" className={`${styles.prayerButton} ${styles.prayerButtonPrimary}`}>
                  Donate now
                </button>
                <button type="button" className={styles.prayerButton}>
                  Notify me
                </button>
              </div>
              <div className={styles.prayerFooter}>
                <strong>Prayer requests</strong>
                <span>- Live rooms - Guided intercession</span>
              </div>
            </div>
          </div>
        ) : null}

        {!isPrayer ? (
          <div className={styles.contentRow}>
            <div className={styles.videoMeta}>
              <div className={styles.creatorRow}>
                <div className={styles.creatorAvatar}>
                  {heroVideo ? heroVideo.user.name.slice(0, 1).toUpperCase() : '?'}
                </div>
                <div>
                  <p className={styles.creatorHandle}>
                    {heroVideo ? `@${heroVideo.user.id}` : '@creator'}
                    <span className={styles.creatorChurch}>
                      {heroVideo?.user.churchHome || heroVideo?.user.ministryRole || 'Vessel Community'}
                    </span>
                  </p>
                  <p className={styles.creatorName}>{heroVideo?.user.name ?? 'Featured Creator'}</p>
                </div>
                <button type="button" className={styles.followButton}>
                  Follow
                </button>
              </div>
              <p className={styles.videoCategory}>{heroVideo?.category?.toUpperCase() ?? 'WORSHIP'}</p>
              <h1 className={styles.videoTitle}>{heroVideo?.title ?? 'Sunrise Worship Session'}</h1>
              <p className={styles.videoDescription}>{heroVideo?.description ?? 'An intimate moment of worship.'}</p>
              <p className={styles.videoDescription}>
                {heroVideo?.scripture?.reference ?? 'Psalms 113:3'}
              </p>
          </div>

          <div className={styles.actionRail}>
            <button type="button" className={styles.actionButton}>
              <span role="img" aria-label="likes">
                🤍
              </span>
              <small>{likesDisplay}</small>
            </button>
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setIsCommentsOpen(true)}
              disabled={!heroVideo}
            >
              <span role="img" aria-label="comments">
                💬
              </span>
              <small>{commentsDisplay}</small>
            </button>
            <button type="button" className={styles.actionButton}>
              <span role="img" aria-label="saves">
                🔖
              </span>
              <small>{savesDisplay}</small>
            </button>
            <button type="button" className={styles.actionButton}>
              <span role="img" aria-label="gift">
                🎁
              </span>
            </button>
          </div>
        </div>
        ) : null}

      </div>

      {isCommentsOpen ? (
        <div className={styles.commentsOverlay} role="dialog" aria-modal="true">
          <div className={styles.commentsSheet}>
              <div className={styles.commentsHeader}>
                <span className={styles.commentCount}>{comments.length ? `${comments.length.toLocaleString()} comments` : 'Comments'}</span>
                <button type="button" className={styles.close} onClick={() => setIsCommentsOpen(false)} aria-label="Close comments">
                  ✕
                </button>
              </div>
              <div className={styles.commentList}>
                {commentsLoading ? <div className={styles.commentStatus}>Loading comments...</div> : null}
                {commentsError ? <div className={`${styles.commentStatus} ${styles.commentError}`}>{commentsError}</div> : null}
                {!commentsLoading && !commentsError && !comments.length ? (
                  <div className={styles.empty}>Be the first to encourage this creator.</div>
                ) : null}

                {comments.map((comment) => (
                  <div key={comment.id} className={styles.comment}>
                    <div className={styles.commentAvatar}>{(comment.user.name || 'Friend').slice(0, 1).toUpperCase()}</div>
                    <div className={styles.commentBody}>
                      <div className={styles.commentTop}>
                        <span className={styles.commentAuthor}>{comment.user.name}</span>
                        <span className={styles.commentMeta}>{comment.user.handle ? `@${comment.user.handle}` : 'listener'} • {formatRelativeTime(comment.createdAt)}</span>
                      </div>
                      <p>{comment.body}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.commentComposer}>
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                />
                <button type="button" onClick={async () => {
                  if (!heroVideo?.id || !commentText.trim() || commentBusy) return
                  setCommentBusy(true)
                  try {
                    const comment = await contentService.recordComment(heroVideo.id, commentText.trim())
                    setComments((prev) => [comment, ...prev])
                    setCommentText('')
                  } catch (err) {
                    const message = err instanceof Error ? err.message : 'We could not post your encouragement. Please try again shortly.'
                    window.alert(message)
                  } finally {
                    setCommentBusy(false)
                  }
                }} disabled={!commentText.trim() || commentBusy}>
                  {commentBusy ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
        </div>
      ) : null}
    </div>
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
