import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './Inbox.module.css'
import { AuthOverlay, type AuthMode } from './Settings'
import {
  contentService,
  type MessageThread,
  type ThreadMessage,
  type SuggestedConnection,
  type NotificationSummary,
  type ContactMatch,
} from '../services/contentService'
import { formatRelativeTime, formatDateTime } from '../utils/time'

type TabKey = 'notifications' | 'messages' | 'suggested'

type SuggestedCard = SuggestedConnection & {
  isFollowing: boolean
}

export default function Inbox() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeProfile, setActiveProfile] = React.useState(() => contentService.getActiveProfile())
  const selfHandle = normalizeHandle(activeProfile.id || '')
  const [tab, setTab] = React.useState<TabKey>('notifications')
  const [threads, setThreads] = React.useState<MessageThread[]>([])
  const [threadsLoading, setThreadsLoading] = React.useState(true)
  const [threadsError, setThreadsError] = React.useState<string | null>(null)
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const [expandedThreadId, setExpandedThreadId] = React.useState<string | null>(null)
  const [messages, setMessages] = React.useState<ThreadMessage[]>([])
  const [messagesBusy, setMessagesBusy] = React.useState(false)
  const [messageError, setMessageError] = React.useState<string | null>(null)
  const [sendingThreadId, setSendingThreadId] = React.useState<string | null>(null)
  const [drafts, setDrafts] = React.useState<Record<string, string>>({})
  const [suggestions, setSuggestions] = React.useState<SuggestedCard[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = React.useState(true)
  const [suggestionsError, setSuggestionsError] = React.useState<string | null>(null)
  const [followBusyId, setFollowBusyId] = React.useState<string | null>(null)
  const [authMode, setAuthMode] = React.useState<AuthMode | null>(null)
  const [notifications, setNotifications] = React.useState<NotificationSummary[]>([])
  const [notificationsLoading, setNotificationsLoading] = React.useState(false)
  const [notificationsError, setNotificationsError] = React.useState<string | null>(null)
  const [composeVisible, setComposeVisible] = React.useState(false)
  const [composeHandle, setComposeHandle] = React.useState('')
  const [composeDraft, setComposeDraft] = React.useState('')
  const [composeBusy, setComposeBusy] = React.useState(false)
  const [composeError, setComposeError] = React.useState<string | null>(null)
  const [composeNotice, setComposeNotice] = React.useState<string | null>(null)
  const [mutualContacts, setMutualContacts] = React.useState<ContactMatch[]>([])
  const [mutualLoading, setMutualLoading] = React.useState(false)
  const [mutualError, setMutualError] = React.useState<string | null>(null)
  const [handleSuggestions, setHandleSuggestions] = React.useState<ContactMatch[]>([])
  const [mutualConnectionsPopup, setMutualConnectionsPopup] = React.useState<{
    suggestionId: string
    suggestionHandle: string
    mutualHandles: string[]
  } | null>(null)
  const isAuthenticated = contentService.isAuthenticated()
  const threadRefs = React.useRef<Record<string, HTMLDivElement | null>>({})
  const messageListRef = React.useRef<HTMLDivElement | null>(null)

  const openProfileFromSuggestion = React.useCallback(
    (handle: string) => {
      const target = normalizeHandle(handle)
      if (target) {
        navigate(`/profile/${target}`)
      }
    },
    [navigate]
  )

  React.useEffect(() => {
    const unsubscribe = contentService.subscribe(() => {
      setActiveProfile(contentService.getActiveProfile())
    })
    return unsubscribe
  }, [])

  React.useEffect(() => {
    let cancelled = false

    async function loadThreads() {
      setThreadsLoading(true)
      setThreadsError(null)
      try {
        const data = await contentService.fetchMessageThreads()
        if (!cancelled) {
          setThreads(data)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load conversations.'
          setThreadsError(message)
        }
      } finally {
        if (!cancelled) {
          setThreadsLoading(false)
        }
      }
    }

    void loadThreads()

    return () => {
      cancelled = true
    }
  }, [])


  const openComposer = React.useCallback(
    (handle?: string) => {
      setTab('messages')
      setComposeVisible(true)
      setComposeNotice(null)
      setComposeError(null)
      if (handle) {
        setComposeHandle(handle.replace(/^@/, ''))
      }
    },
    []
  )

  React.useEffect(() => {
    const composeHandleParam = searchParams.get('compose')
    if (composeHandleParam) {
      openComposer(composeHandleParam)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('compose')
      setSearchParams(nextParams, { replace: true })
    }
  }, [openComposer, searchParams, setSearchParams])

  React.useEffect(() => {
    let cancelled = false

    if (!isAuthenticated) {
      setNotifications([])
      setNotificationsLoading(false)
      setNotificationsError('Sign in to view your latest activity.')
      return () => {
        cancelled = true
      }
    }

    async function loadNotifications() {
      setNotificationsLoading(true)
      setNotificationsError(null)
      try {
        const items = await contentService.fetchNotifications()
        if (!cancelled) {
          // Filter out previously dismissed notifications
          try {
            const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]') as string[]
            const filtered = items.filter((item) => !dismissed.includes(item.id))
            setNotifications(filtered)
          } catch (err) {
            console.error('Failed to filter dismissed notifications', err)
            setNotifications(items)
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load notifications.'
          setNotificationsError(message)
        }
      } finally {
        if (!cancelled) {
          setNotificationsLoading(false)
        }
      }
    }

    void loadNotifications()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, activeProfile.id])

  React.useEffect(() => {
    if (!activeConversationId) {
      setMessages([])
      return
    }
    let cancelled = false

    async function loadMessages() {
      setMessagesBusy(true)
      setMessageError(null)
      try {
        const data = await contentService.fetchThreadMessages(activeConversationId)
        if (!cancelled) {
          setMessages(data)
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unable to load this conversation.'
          setMessageError(message)
        }
      } finally {
        if (!cancelled) {
          setMessagesBusy(false)
        }
      }
    }

    void loadMessages()

    return () => {
      cancelled = true
    }
  }, [activeConversationId])

  React.useEffect(() => {
    let cancelled = false
    async function loadSuggestions() {
      setSuggestionsLoading(true)
      setSuggestionsError(null)
      try {
        const data = await contentService.fetchConnectionSuggestions(4)
        if (!cancelled) {
          // Filter out previously dismissed suggestions and the current user
          try {
            const dismissed = JSON.parse(localStorage.getItem('dismissedSuggestions') || '[]') as string[]
            const filtered = data.filter((item) => {
              // Exclude dismissed items
              if (dismissed.includes(item.id)) return false
              // Exclude current user by comparing normalized handles
              const itemHandle = normalizeHandle(item.handle)
              const currentHandle = normalizeHandle(selfHandle)
              return itemHandle !== currentHandle
            })
            setSuggestions(
              filtered.map((item) => ({
                ...item,
                isFollowing: contentService.isFollowing(item.handle),
              }))
            )
          } catch (err) {
            console.error('Failed to filter dismissed suggestions', err)
            // Fallback: at minimum filter out current user
            const filtered = data.filter((item) => {
              const itemHandle = normalizeHandle(item.handle)
              const currentHandle = normalizeHandle(selfHandle)
              return itemHandle !== currentHandle
            })
            setSuggestions(
              filtered.map((item) => ({
                ...item,
                isFollowing: contentService.isFollowing(item.handle),
              }))
            )
          }
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : 'Unable to load suggested connections right now.'
          setSuggestionsError(message)
          setSuggestions([])
        }
      } finally {
        if (!cancelled) {
          setSuggestionsLoading(false)
        }
      }
    }
    void loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [activeProfile.id, selfHandle])

  React.useEffect(() => {
    if (!isAuthenticated || tab !== 'messages') {
      setMutualContacts([])
      setMutualError(null)
      return
    }
    let cancelled = false
    setMutualLoading(true)
    setMutualError(null)
    Promise.all([contentService.fetchFollowingProfiles(), contentService.fetchFollowerProfiles()])
      .then(([following, followers]) => {
        if (cancelled) return
        const followerMap = new Map(followers.map((u) => [normalizeHandle(u.handle || u.id), u]))
        const mutual = following
          .filter((user) => followerMap.has(normalizeHandle(user.handle || user.id)))
          .map((user) => ({
            id: user.id,
            handle: user.handle || user.id,
            name: user.name || user.handle || user.id,
            email: user.email,
            church: user.church,
            country: user.country,
            photoUrl: user.photoUrl,
          }))
        setMutualContacts(mutual)
      })
      .catch((error) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Unable to load mutual connections.'
        setMutualError(message)
      })
      .finally(() => {
        if (cancelled) return
        setMutualLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, tab])

  React.useEffect(() => {
    if (tab === 'messages' && !activeConversationId && threads.length > 0) {
      const firstId = threads[0].id
      setActiveConversationId(firstId)
      setExpandedThreadId(firstId)
    }
  }, [tab, threads, activeConversationId])

  // Auto-scroll to bottom when messages change or conversation opens
  React.useEffect(() => {
    if (messageListRef.current && messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (messageListRef.current) {
          messageListRef.current.scrollTop = messageListRef.current.scrollHeight
        }
      })
    }
  }, [messages, expandedThreadId])

  const activeThread = activeConversationId ? threads.find((thread) => thread.id === activeConversationId) ?? null : null

  React.useEffect(() => {
    if (!expandedThreadId || !activeConversationId) return
    const target = threadRefs.current[expandedThreadId]
    if (!target) return
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' })
    })
  }, [expandedThreadId, activeConversationId])

  React.useEffect(() => {
    const shouldLock = expandedThreadId && tab === 'messages'
    if (!shouldLock) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [expandedThreadId, tab])

  function handleSelectThread(id: string) {
    setExpandedThreadId((current) => (current === id ? null : id))
    setActiveConversationId(id)
    setThreads((current) => current.map((thread) => (thread.id === id ? { ...thread, unreadCount: 0 } : thread)))
  }

  const handleOpenThreadProfile = React.useCallback(
    (event: React.MouseEvent, handle: string | null) => {
      if (!handle) return
      event.stopPropagation()
      navigate(`/profile/${handle}`)
    },
    [navigate]
  )

  const dismissNotification = React.useCallback(async (id: string) => {
    // Optimistically update UI
    setNotifications((current) => current.filter((item) => item.id !== id))

    // Persist to server
    try {
      await contentService.dismissNotification(id)
      // Also persist to localStorage as backup
      const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]') as string[]
      if (!dismissed.includes(id)) {
        dismissed.push(id)
        localStorage.setItem('dismissedNotifications', JSON.stringify(dismissed))
      }
    } catch (err) {
      console.error('Failed to dismiss notification on server', err)
      // Revert optimistic update on error
      const notifications = await contentService.fetchNotifications()
      setNotifications(notifications)
    }
  }, [])

  function updateDraft(threadId: string, value: string) {
    setDrafts((current) => ({ ...current, [threadId]: value }))
  }

  function updateHandleSuggestions(query: string) {
    const trimmed = normalizeHandle(query)
    if (!trimmed || !mutualContacts.length) {
      setHandleSuggestions([])
      return
    }
    const matches = mutualContacts
      .filter((contact) => {
        const handle = normalizeHandle(contact.handle || contact.id)
        const name = normalizeHandle(contact.name || '')
        return handle.includes(trimmed) || name.includes(trimmed)
      })
      .slice(0, 5)
    setHandleSuggestions(matches)
  }

  async function sendMessage(conversationId: string, overrideText?: string) {
    const text = (overrideText ?? drafts[conversationId] ?? '').trim()
    if (!text) return
    setSendingThreadId(conversationId)
    try {
      const message = await contentService.sendThreadMessage(conversationId, text)
      if (conversationId === activeConversationId) {
        setMessages((current) => [...current, message])
      }
      setThreads((current) =>
        current
          .map((thread) =>
            thread.id === conversationId
              ? { ...thread, lastMessage: message, unreadCount: 0, updatedAt: message.createdAt }
              : thread
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      )
      setDrafts((current) => ({ ...current, [conversationId]: '' }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send that message right now.'
      window.alert(message)
    } finally {
      setSendingThreadId((current) => (current === conversationId ? null : current))
    }
  }

  async function followSuggestionCard(id: string) {
    const target = suggestions.find((item) => item.id === id)
    if (!target || target.isFollowing) {
      return
    }
    setFollowBusyId(id)
    try {
      await contentService.followUser(target.handle)
      setSuggestions((current) => current.map((item) => (item.id === id ? { ...item, isFollowing: true } : item)))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to follow right now.'
      window.alert(message)
    } finally {
      setFollowBusyId((current) => (current === id ? null : current))
    }
  }

  function dismissSuggestion(id: string) {
    setSuggestions((current) => current.filter((item) => item.id !== id))
    // Persist dismissed suggestion
    try {
      const dismissed = JSON.parse(localStorage.getItem('dismissedSuggestions') || '[]') as string[]
      if (!dismissed.includes(id)) {
        dismissed.push(id)
        localStorage.setItem('dismissedSuggestions', JSON.stringify(dismissed))
      }
    } catch (err) {
      console.error('Failed to persist dismissed suggestion', err)
    }
  }

  async function showMutualConnections(suggestionId: string, suggestionHandle: string) {
    try {
      // Fetch current user's following and followers
      const [followingProfiles, followerProfiles] = await Promise.all([
        contentService.fetchFollowingProfiles(),
        contentService.fetchFollowerProfiles(),
      ])

      // Build set of people who follow the current user
      const currentUserFollowerHandles = new Set(
        followerProfiles.map(profile => normalizeHandle(profile.handle || profile.id))
      )

      // Find people the current user follows who also follow them back (mutual friends)
      // These are the people who know both you and potentially the suggested user
      const mutualFriends = followingProfiles
        .filter(profile => {
          const handle = normalizeHandle(profile.handle || profile.id)
          return handle && currentUserFollowerHandles.has(handle)
        })
        .slice(0, 10) // Show up to 10 mutual connections
        .map(profile => profile.handle || profile.id)

      setMutualConnectionsPopup({
        suggestionId,
        suggestionHandle,
        mutualHandles: mutualFriends,
      })
    } catch (error) {
      console.error('Failed to fetch mutual connections:', error)
      // Show popup with empty list on error
      setMutualConnectionsPopup({
        suggestionId,
        suggestionHandle,
        mutualHandles: [],
      })
    }
  }

  async function startNewConversation(event: React.FormEvent) {
    event.preventDefault()
    const target = composeHandle.trim().replace(/^@/, '').toLowerCase()
    const body = composeDraft.trim()
    if (!target || !body) {
      setComposeError('Enter a handle and your message before sending.')
      return
    }
    setComposeError(null)

    const existingThread = threads.find((thread) => {
      const participant = resolveThreadTargetHandle(thread, selfHandle)
      return participant && normalizeHandle(participant) === target
    })
    if (existingThread) {
      setActiveConversationId(existingThread.id)
      setExpandedThreadId(existingThread.id)
      setComposeVisible(false)
      setComposeDraft('')
      setComposeHandle('')
      setComposeError(null)
      setComposeNotice(null)
      setHandleSuggestions([])
      return
    }

    setComposeBusy(true)
    setComposeError(null)
    try {
      const thread = await contentService.startConversation(target, body)
      setThreads((current) => {
        const filtered = current.filter((item) => item.id !== thread.id)
        return [thread, ...filtered].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      })
      setActiveConversationId(thread.id)
      setComposeDraft('')
      setComposeHandle('')
      setComposeVisible(false)
      setComposeNotice(null)
      setHandleSuggestions([])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'We could not start that conversation. Please try again.'
      setComposeError(message)
    } finally {
      setComposeBusy(false)
    }
  }

  const handleAuthClose = React.useCallback(() => {
    setAuthMode(null)
  }, [])

  const handleAuthSwitch = React.useCallback((mode: AuthMode | null) => {
    setAuthMode(mode)
  }, [])

  const handleAuthComplete = React.useCallback(() => {
    setAuthMode(null)
  }, [])


  let tabContent: React.ReactNode

  if (tab === 'notifications') {
    if (!isAuthenticated) {
      tabContent = (
        <div className={styles.status}>
          <p>Sign in to receive new follower, like, and comment alerts here.</p>
          <button type="button" className={styles.statusAction} onClick={() => setAuthMode('login')}>
            Sign in
          </button>
        </div>
      )
    } else if (notificationsLoading) {
      tabContent = <div className={styles.status}>Checking for new activity...</div>
    } else if (notificationsError) {
      tabContent = (
        <div className={styles.status}>
          <p>{notificationsError}</p>
          <button
            type="button"
            className={styles.statusAction}
            onClick={() => {
              setNotificationsLoading(true)
              setNotificationsError(null)
              contentService
                .fetchNotifications()
                .then((items) => {
                  try {
                    const dismissed = JSON.parse(localStorage.getItem('dismissedNotifications') || '[]') as string[]
                    const filtered = items.filter((item) => !dismissed.includes(item.id))
                    setNotifications(filtered)
                  } catch (err) {
                    console.error('Failed to filter dismissed notifications', err)
                    setNotifications(items)
                  }
                })
                .catch((error) => {
                  const message = error instanceof Error ? error.message : 'Unable to refresh notifications.'
                  setNotificationsError(message)
                })
                .finally(() => setNotificationsLoading(false))
            }}
          >
            Try again
          </button>
        </div>
      )
    } else if (!notifications.length) {
      tabContent = (
        <div className={styles.status}>
          You're all caught up. When someone follows, likes, or comments on your videos, it will appear here.
        </div>
      )
    } else {
      tabContent = notifications.map((item) => {
        const actorHandle = formatHandle(item.actor.handle || item.actor.name)
        const actorTarget = resolveNotificationActorTarget(item.actor)
        const copy = formatNotificationCopy(item)
        return (
          <article key={item.id} className={styles.notificationCard}>
            <div className={styles.notificationIcon}>{badgeIcon(item.type)}</div>
            <div className={styles.notificationCopy}>
              <span className={styles.notificationMessage}>
                <button
                  type="button"
                  className={styles.notificationHandle}
                  onClick={() => navigate(`/profile/${actorTarget}`)}
                >
                  {actorHandle}
                </button>{' '}
                {copy}
              </span>
              {item.commentPreview ? (
                <span className={styles.notificationPreview}>{item.commentPreview}</span>
              ) : null}
              <span className={styles.notificationTime}>{formatRelativeTime(item.createdAt)}</span>
            </div>
            <button
              type="button"
              className={styles.notificationDismiss}
              aria-label="Dismiss notification"
              onClick={() => dismissNotification(item.id)}
            >
              ×
            </button>
          </article>
        )
      })
    }
  } else if (tab === 'messages') {
    const composeSection = !isAuthenticated ? null : (
      <div className={styles.composeLauncher}>
        {composeVisible ? (
          <form className={styles.composeForm} onSubmit={startNewConversation}>
            <div className={styles.composeRow}>
              <label>
                To
                <div className={styles.handleInputWrap}>
                  <span className={styles.handlePrefix}>@</span>
                  <input
                    value={composeHandle}
                    onChange={(event) => {
                      const next = event.target.value.replace(/^@/, '')
                      setComposeHandle(next)
                      updateHandleSuggestions(next)
                    }}
                    placeholder="friend"
                    disabled={composeBusy}
                  />
                </div>
              </label>
              <button
                type="button"
                className={styles.dismissButton}
                onClick={() => {
                  setComposeVisible(false)
                  setComposeDraft('')
                  setComposeHandle('')
                  setComposeError(null)
                  setComposeNotice(null)
                  setHandleSuggestions([])
                }}
                aria-label="Close composer"
              >
                ×
              </button>
            </div>
            {handleSuggestions.length ? (
              <ul className={styles.handleSuggestions}>
                {handleSuggestions.map((contact) => (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setComposeHandle(contact.handle || contact.id)
                        updateHandleSuggestions(contact.handle || contact.id)
                      }}
                    >
                      <span className={styles.handleSuggestionName}>{formatHandle(contact.handle || contact.id)}</span>
                      <span className={styles.handleSuggestionMeta}>{contact.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <textarea
              value={composeDraft}
              onChange={(event) => setComposeDraft(event.target.value)}
              placeholder="Type your message..."
              rows={3}
              disabled={composeBusy}
            />
            {composeError ? <p className={styles.composeError}>{composeError}</p> : null}
            {composeNotice ? <p className={styles.composeNotice}>{composeNotice}</p> : null}
            <div className={styles.composeActions}>
              <button type="submit" disabled={composeBusy || !composeDraft.trim() || !composeHandle.trim()}>
                {composeBusy ? 'Sending...' : 'Send'}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setComposeVisible(false)
                  setComposeDraft('')
                  setComposeHandle('')
                  setComposeError(null)
                  setComposeNotice(null)
                  setHandleSuggestions([])
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className={styles.composeButton} onClick={() => openComposer()}>
            New message
          </button>
        )}
      </div>
    )


    if (threadsLoading) {
      tabContent = (
        <>
          {composeSection}
          <div className={styles.status}>Loading conversations...</div>
        </>
      )
    } else if (threadsError) {
      const needsAuth = /sign in/i.test(threadsError)
      tabContent = (
        <div className={styles.status}>
          <p>{threadsError}</p>
          {needsAuth ? (
            <button type="button" className={styles.statusAction} onClick={() => setAuthMode('login')}>
              Please sign in to continue
            </button>
          ) : null}
        </div>
      )
    } else if (!threads.length) {
      tabContent = (
        <>
          {composeSection}
          <div className={styles.status}>
            No messages yet. Visit Suggested to follow people you know and start the first conversation.
          </div>
        </>
      )
    } else {
      tabContent = (
        <>
          {composeSection}
          {threads.map((thread) => {
            const isActive = thread.id === activeConversationId
            const draftValue = drafts[thread.id] ?? ''
            const title = pickThreadTitle(thread, selfHandle)
            const preview = thread.lastMessage?.body ?? 'Start the conversation.'
            const lastTimestamp = thread.lastMessage?.createdAt ?? thread.updatedAt
            const timeAgo = `${formatDateTime(lastTimestamp)} • ${formatRelativeTime(lastTimestamp, true)}`
            const badgeLetter = (title.replace(/^@/, '') || 'c')[0]?.toUpperCase() ?? 'C'
            const isSending = sendingThreadId === thread.id
            const targetHandle = resolveThreadTargetHandle(thread, selfHandle)
            const isExpanded = Boolean(isActive && activeThread && expandedThreadId === thread.id)
            return (
              <article
                key={thread.id}
                ref={(node) => {
                  threadRefs.current[thread.id] = node
                }}
                className={`${styles.threadCard} ${isExpanded ? styles.threadCardExpanded : ''}`}
              >
                <button
                  type="button"
                  className={`${styles.threadSummary} ${isExpanded ? styles.threadSummaryActive : ''}`}
                  onClick={() => handleSelectThread(thread.id)}
                  aria-expanded={isExpanded}
                >
                  <div className={`${styles.threadAvatar} ${thread.unreadCount > 0 ? styles.unread : ''}`}>
                    {badgeLetter}
                  </div>
                  <div className={styles.threadCopy}>
                    <div className={styles.threadTitleRow}>
                      <span
                        className={`${styles.threadActor} ${targetHandle ? styles.threadActorLink : ''}`}
                        title={targetHandle ? `View ${formatHandle(targetHandle)}'s profile` : undefined}
                        onClick={(event) => handleOpenThreadProfile(event, targetHandle)}
                      >
                        {title}
                      </span>
                      <span className={styles.threadTime}>{timeAgo}</span>
                    </div>
                    <p className={styles.threadPreview}>{preview}</p>
                  </div>
                </button>

                <div
                  className={`${styles.conversation} ${isExpanded ? styles.conversationOpen : styles.conversationClosed}`}
                  aria-hidden={!isExpanded}
                >
                  {isExpanded ? (
                    <>
                      {targetHandle ? (
                        <div className={styles.conversationHandleRow}>
                          <span className={styles.conversationHandleLabel}>Chatting with</span>
                          <button
                            type="button"
                            className={styles.conversationHandle}
                            onClick={(event) => handleOpenThreadProfile(event, targetHandle)}
                          >
                            {formatHandle(targetHandle)}
                          </button>
                        </div>
                      ) : null}
                      {messageError ? <div className={styles.contactError}>{messageError}</div> : null}
                      <div className={styles.messageList} ref={messageListRef}>
                        {messagesBusy && !messages.length ? (
                          <div className={styles.status}>Loading conversation...</div>
                        ) : null}
                        {messages.map((message, msgIndex) => {
                          const fromMe = isMessageFromCurrentUser(message, selfHandle)
                          const messageTimestamp = `${formatDateTime(message.createdAt)} • ${formatRelativeTime(
                            message.createdAt
                          )}`
                          return (
                            <div
                              key={message.id}
                              className={`${styles.bubble} ${fromMe ? styles.bubbleMe : styles.bubbleThem}`}
                            >
                              <span>{message.body}</span>
                              <span className={styles.bubbleMeta}>{messageTimestamp}</span>
                            </div>
                          )
                        })}
                      </div>

                      <form
                        className={styles.composer}
                        onSubmit={(event) => {
                          event.preventDefault()
                          sendMessage(thread.id)
                        }}
                      >
                        <textarea
                          value={draftValue}
                          onChange={(event) => updateDraft(thread.id, event.target.value)}
                          placeholder="Type a message..."
                          rows={2}
                          disabled={isSending}
                        />
                        <button type="submit" disabled={!draftValue.trim() || isSending}>
                          <img src="/media/icons/icons8-send-arrow.svg" alt="Send" style={{ width: '20px', height: '20px' }} />
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </article>
            )
          })}
        </>
      )
    }
  } else {
    tabContent = (
      <div className={styles.suggestedPanel}>
        {suggestionsLoading ? (
          <div className={styles.status}>Finding people you may know...</div>
        ) : suggestionsError ? (
          <div className={styles.status}>{suggestionsError}</div>
        ) : !suggestions.length ? (
          <div className={styles.status}>No suggestions yet. Follow a few creators to see familiar faces here.</div>
        ) : (
          suggestions.map((suggestion) => {
            const avatarLetter = formatHandle(suggestion.handle).slice(1, 2).toUpperCase()
            const mutualText =
              suggestion.mutualConnections > 1
                ? `${suggestion.mutualConnections} mutual connections`
                : '1 mutual connection'
            const followDisabled = suggestion.isFollowing || followBusyId === suggestion.id
            return (
              <article key={suggestion.id} className={styles.suggestionCard}>
                <div className={styles.suggestionAvatar}>
                  {suggestion.photoUrl ? (
                    <img src={suggestion.photoUrl} alt={suggestion.name} />
                  ) : (
                    avatarLetter
                  )}
                </div>
                <div className={styles.suggestionContent}>
                  <div className={styles.suggestionTopRow}>
                    <div className={styles.suggestionTextGroup}>
                      <span className={styles.suggestionLabel}>You may know</span>
                      <button
                        type="button"
                        className={styles.suggestionHandle}
                        onClick={() => openProfileFromSuggestion(suggestion.handle)}
                        aria-label={`View ${formatHandle(suggestion.handle)} profile`}
                      >
                        {formatHandle(suggestion.handle)}
                      </button>
                      <button
                        type="button"
                        className={styles.suggestionMeta}
                        onClick={() => showMutualConnections(suggestion.id, suggestion.handle)}
                      >
                        {mutualText}
                      </button>
                    </div>
                    <div className={styles.suggestionActionsCompact}>
                      <button
                        type="button"
                        className={styles.followButton}
                        disabled={followDisabled}
                        onClick={() => followSuggestionCard(suggestion.id)}
                      >
                        {suggestion.isFollowing ? 'Following' : followDisabled ? 'Following...' : 'Follow'}
                      </button>
                      <button
                        type="button"
                        aria-label="Dismiss suggestion"
                        className={styles.dismissButton}
                        onClick={() => dismissSuggestion(suggestion.id)}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  {suggestion.summary ? <small className={styles.suggestionSummary}>{suggestion.summary}</small> : null}
                </div>
              </article>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div className={styles.inbox}>
      {mutualConnectionsPopup ? (
        <div className={styles.overlay} onClick={() => setMutualConnectionsPopup(null)}>
          <div className={styles.mutualPopup} onClick={(e) => e.stopPropagation()}>
            <header className={styles.mutualPopupHeader}>
              <h3>
                {mutualConnectionsPopup.mutualHandles.length}{' '}
                {mutualConnectionsPopup.mutualHandles.length === 1 ? 'mutual connection' : 'mutual connections'}
              </h3>
              <button
                type="button"
                className={styles.mutualPopupClose}
                onClick={() => setMutualConnectionsPopup(null)}
                aria-label="Close"
              >
                ×
              </button>
            </header>
            <div className={styles.mutualPopupList}>
              {mutualConnectionsPopup.mutualHandles.length === 0 ? (
                <p className={styles.mutualPopupEmpty}>No mutual connections found</p>
              ) : (
                mutualConnectionsPopup.mutualHandles.map((handle) => (
                  <button
                    key={handle}
                    type="button"
                    className={styles.mutualPopupItem}
                    onClick={() => {
                      setMutualConnectionsPopup(null)
                      navigate(`/profile/${handle}`)
                    }}
                  >
                    <div className={styles.mutualPopupAvatar}>{formatHandle(handle).slice(1, 2).toUpperCase()}</div>
                    <span className={styles.mutualPopupHandle}>{formatHandle(handle)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
      <div className={styles.inboxCard}>
        <header className={styles.hero}>
          <h1>Inbox</h1>
          <p>Track your notifications, donations, and messages in one place.</p>
        </header>

        <div className={styles.tabBar}>
          <button
            type="button"
            className={tab === 'notifications' ? styles.tabActive : styles.tab}
            onClick={() => setTab('notifications')}
          >
            Notifications
          </button>
          <button type="button" className={tab === 'messages' ? styles.tabActive : styles.tab} onClick={() => setTab('messages')}>
            Messages
          </button>
          <button
            type="button"
            className={tab === 'suggested' ? styles.tabActive : styles.tab}
            onClick={() => setTab('suggested')}
          >
            Suggested
          </button>
        </div>

        <section className={styles.panel}>{tabContent}</section>
      </div>
      {authMode ? (
        <AuthOverlay
          mode={authMode}
          activeProfile={activeProfile}
          onClose={handleAuthClose}
          onSwitchMode={handleAuthSwitch}
          onComplete={handleAuthComplete}
        />
      ) : null}
    </div>
  )
}

function badgeIcon(type: NotificationSummary['type']) {
  switch (type) {
    case 'like':
      return '❤️'
    case 'comment':
      return '💬'
    case 'follow':
    default:
      return '➕'
  }
}

function formatNotificationCopy(item: NotificationSummary): string {
  switch (item.type) {
    case 'follow':
      return 'started following you.'
    case 'like': {
      const label = item.videoTitle ? `"${item.videoTitle}"` : 'your video'
      return `liked ${label}.`
    }
    case 'comment': {
      const label = item.videoTitle ? `"${item.videoTitle}"` : 'your video'
      return `commented on ${label}.`
    }
    default:
      return 'sent you an update.'
  }
}

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function formatHandle(value: string): string {
  if (!value) return '@friend'
  return value.startsWith('@') ? value : `@${value}`
}

function findThreadPartner(
  thread: MessageThread,
  selfHandle: string
): MessageThread['participants'][number] | null {
  return (
    thread.participants.find((member) => normalizeHandle(member.handle || member.name) !== selfHandle) ??
    thread.participants[0] ??
    null
  )
}

function resolveThreadTargetHandle(thread: MessageThread, selfHandle: string): string | null {
  const participant = findThreadPartner(thread, selfHandle)
  if (!participant) return null
  const handle = (participant.handle || participant.name || '').trim()
  return handle ? normalizeHandle(handle) : null
}

function pickThreadTitle(thread: MessageThread, selfHandle: string): string {
  const participant = findThreadPartner(thread, selfHandle)
  if (!participant) {
    return 'Conversation'
  }
  const handle = participant.handle ? formatHandle(participant.handle) : ''
  return handle || participant.name || 'Conversation'
}

function isMessageFromCurrentUser(message: ThreadMessage, selfHandle: string): boolean {
  return normalizeHandle(message.sender.handle || message.sender.name) === selfHandle
}

function resolveNotificationActorTarget(actor: NotificationSummary['actor']): string {
  const handle = (actor.handle || '').trim()
  if (handle) {
    return handle.replace(/^@/, '')
  }
  const identifier = (actor.id || '').trim()
  if (identifier) {
    return identifier
  }
  const fallback = (actor.name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return fallback || 'creator'
}
