import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ForYou from './ForYou'
import Following from './Following'
import Friends from './Friends'
import styles from './Feed.module.css'
import type { Video } from '../services/contentService'
import { Media } from '../media'
import { SearchIcon } from '../shared/icons'
import { contentService } from '../services/contentService'

type TabKey = 'following' | 'friends' | 'forYou' | 'prayer'

const tabs: Array<{
  id: TabKey
  label: string
  filter?: (clip: Video) => boolean
}> = [
  { id: 'following', label: 'Following' },
  { id: 'friends', label: 'Friends' },
  { id: 'forYou', label: 'For You' },
  { id: 'prayer', label: 'Prayer', filter: () => false },
]

export default function Feed() {
  const location = useLocation()
  const initialTab: TabKey = location.pathname === '/friends' ? 'friends' : 'forYou'
  const [tab, setTab] = React.useState<TabKey>(initialTab)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchResults, setSearchResults] = React.useState<{ accounts: any[]; videos: Video[]; categories: string[] } | null>(null)
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()

  const handleSearch = React.useCallback(() => {
    setSearchOpen((v) => {
      const next = !v
      if (!next) {
        // closing the search should also hide results
        setShowResults(false)
        setSearchQuery('')
      }
      return next
    })
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const handleClearSearch = React.useCallback(() => {
    setSearchQuery('')
    setSearchResults(null)
    setShowResults(false)
    setSearchLoading(false)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  async function performSearch(q?: string) {
    const value = (q ?? searchQuery).trim()
    if (!value) {
      setSearchResults(null)
      setSearchLoading(false)
      setShowResults(false)
      return
    }
    setSearchLoading(true)
    try {
      const payload = await contentService.search(value, 25)
      setSearchResults(payload as any)
      setShowResults(true)
    } catch (err) {
      setSearchResults({ accounts: [], videos: [], categories: [] })
      setShowResults(true)
    } finally {
      setSearchLoading(false)
    }
  }

  const [showResults, setShowResults] = React.useState(false)

  // Prevent background scrolling when search results are open
  React.useEffect(() => {
    if (showResults) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [showResults])

  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0]
  const isFriends = tab === 'friends'
  const isPrayer = tab === 'prayer'

  React.useEffect(() => {
    if (location.pathname === '/friends') {
      setTab('friends')
    }
  }, [location.pathname])

  // debounce live search while user types
  React.useEffect(() => {
    if (!searchOpen) return undefined
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults(null)
      setShowResults(false)
      setSearchLoading(false)
      return undefined
    }
    const timer = window.setTimeout(() => {
      void performSearch(trimmed)
    }, 100)
    return () => window.clearTimeout(timer)
  }, [searchQuery, searchOpen])

  // ensure overlay hides when search input is closed
  React.useEffect(() => {
    if (!searchOpen) {
      setShowResults(false)
    }
  }, [searchOpen])

  return (
    <div className={styles.feed}>
      <div className={styles.topChrome}>
        <div className={styles.topBar}>
          <div className={styles.tabHeader}>
            <div className={styles.leftTray}>
              <div className={styles.brandGlyphButton}>
                <img src={Media.icons.logo} alt="Godlyme" className={styles.brandGlyph} />
              </div>
              <div className={styles.tabRail}>
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={tab === item.id ? `${styles.tabButton} ${styles.tabButtonActive}` : styles.tabButton}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.statusIcons}>
              <button type="button" aria-label="Search" onClick={handleSearch}>
                <SearchIcon width={18} height={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        {searchOpen ? (
          <div className={styles.searchBar}>
            <div className={styles.searchField} role="search">
              <SearchIcon width={16} height={16} aria-hidden="true" />
              <input
                ref={inputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (!searchOpen) {
                    setSearchOpen(true)
                  }
                }}
                placeholder="Search creators, testimonies, prayer topics, or verses — start with @ for handles"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void performSearch()
                    requestAnimationFrame(() => inputRef.current?.focus())
                  } else if (e.key === 'Escape') {
                    setSearchOpen(false)
                    setShowResults(false)
                  }
                }}
              />
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            </div>
          </div>
        ) : null}

        {/* render the interactive results panel near the search field */}
        {showResults && searchResults ? (
          <div className={styles.searchOverlay} onClick={() => { setShowResults(false); }}>
            <div className={styles.searchResultsPanel} onClick={(e) => e.stopPropagation()}>
              {searchLoading ? <div className={styles.searchNoResults}>Searching...</div> : null}
              {searchResults.accounts && searchResults.accounts.length ? (
                <div className={styles.searchSection}>
                  <h4>Accounts</h4>
                  {searchResults.accounts.map((acct) => (
                    <button
                      key={acct.id}
                      type="button"
                      className={styles.searchAccountRow}
                      onClick={() => {
                        setShowResults(false)
                        setSearchOpen(false)
                        navigate(`/profile/${acct.handle || acct.id}`)
                      }}
                    >
                      <div className={styles.searchAccountAvatar}>{(acct.name || acct.handle || acct.id).slice(0, 1).toUpperCase()}</div>
                      <div className={styles.searchAccountInfo}>
                        <strong>{acct.name}</strong>
                        <small style={{ opacity: 0.9 }}>{acct.handle ? `@${acct.handle}` : acct.id}</small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {searchResults.videos && searchResults.videos.length ? (
                <div className={styles.searchSection}>
                  <h4>Videos</h4>
                  {searchResults.videos.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className={styles.searchVideoRow}
                      onClick={() => {
                        setShowResults(false)
                        setSearchOpen(false)
                        navigate(`/watch/${encodeURIComponent(v.id)}`)
                      }}
                    >
                      <img className={styles.searchVideoThumb} src={v.thumbnailUrl || ''} alt={v.title} />
                      <div style={{ flex: 1 }}>
                        <strong style={{ display: 'block', textAlign: 'left' }}>{v.title}</strong>
                        <small style={{ opacity: 0.85 }}>{v.user?.name || v.user?.handle}</small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {searchResults.categories && searchResults.categories.length ? (
                <div className={styles.searchSection}>
                  <h4>Categories & tags</h4>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {searchResults.categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={styles.followButton}
                        onClick={() => {
                          setShowResults(false)
                          setSearchOpen(false)
                          navigate(`/home?q=${encodeURIComponent(c)}`)
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {(!searchResults.accounts.length && !searchResults.videos.length) ? (
                <div className={styles.searchNoResults}>No matching accounts or videos yet.</div>
              ) : null}

            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.scroller}>
        {isPrayer ? (
          <div className={styles.prayerWrap}>
            <div className={styles.prayerCards}>
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
          </div>
        ) : tab === 'following' ? (
          <Following />
        ) : isFriends ? (
          <Friends />
        ) : (
          <ForYou filter={activeTab.filter} />
        )}
      </div>
    </div>
  )
}
