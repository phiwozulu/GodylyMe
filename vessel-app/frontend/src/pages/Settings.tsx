import React from "react"
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { contentService, type ActiveProfile } from "../services/contentService"
import { COUNTRY_OPTIONS } from "../shared/countryOptions"
import styles from "./Profile.module.css"

export type AuthMode = "signup" | "login"

const normalize = (value?: string) => (value || "").toLowerCase()

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()

  const [activeProfile, setActiveProfile] = useState<ActiveProfile>(() => contentService.getActiveProfile())
  const [authMode, setAuthMode] = useState<AuthMode | null>(() => parseMode(location.search))

  const routeId = id && id.length ? id : "me"
  const viewedId = routeId === "me" ? activeProfile.id : routeId
  const isSelf = normalize(viewedId) === normalize(activeProfile.id)
  const isGuest = isSelf && normalize(activeProfile.name).includes("guest")

  useEffect(() => {
    const unsubscribe = contentService.subscribe(() => {
      setActiveProfile(contentService.getActiveProfile())
    })
    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    setAuthMode(parseMode(location.search))
  }, [location.search])

  useEffect(() => {
    if (!isSelf) {
      navigate(`/profile/${routeId}`)
    }
  }, [isSelf, navigate, routeId])

  const updateMode = useCallback(
    (mode: AuthMode | null) => {
      setAuthMode(mode)
      const search = mode ? `?mode=${mode}` : ""
      navigate(`/profile/${routeId}/settings${search}`, { replace: true })
    },
    [navigate, routeId]
  )

  const goToProfile = useCallback(() => {
    navigate(`/profile/${routeId}`)
  }, [navigate, routeId])

  const handleSignOut = useCallback(() => {
    contentService.signOut()
    navigate("/profile/me", { replace: true })
  }, [navigate])

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This will permanently delete all your videos, likes, and comments. This action cannot be undone.'
    )
    if (!confirmed) return

    try {
      await contentService.deleteAccount()
      navigate("/", { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to delete account right now.'
      alert(message)
    }
  }, [navigate])

  const handleComplete = useCallback((email?: string) => {
    updateMode(null)
    // If signing up and email provided, navigate to verification page
    if (authMode === 'signup' && email) {
      navigate("/verify-email", { state: { email } })
    } else {
      navigate("/profile/me", { replace: true })
    }
  }, [authMode, navigate, updateMode])

  if (!isSelf) {
    return null
  }

  const handle = activeProfile.id ? `@${activeProfile.id}` : "@guest"
  const displayName = activeProfile.name || "Guest Creator"
  const church = activeProfile.church

  return (
    <div className={styles.profile}>
      <header className={styles.topBar}>
        <button type="button" className={styles.topIcon} onClick={goToProfile} aria-label="Back">
          Back
        </button>
        <div className={styles.topIconGroup}>
          <button type="button" className={styles.topIcon} onClick={goToProfile}>
            Profile
          </button>
        </div>
      </header>

      {!authMode ? (
        <div className={styles.settingsOverlay}>
          <div className={styles.settingsPanel}>
            <button type="button" className={styles.settingsClose} onClick={goToProfile} aria-label="Close settings">
              ×
            </button>
            <div className={styles.settingsHeader}>
              <h3>Account settings</h3>
              <p>Manage how you appear across Godly Me.</p>
            </div>
            <div className={styles.settingsSummary}>
              <SettingsRow label="Status" value={isGuest ? "Browsing as guest" : "Signed in"} />
              <SettingsRow label="Display name" value={displayName} />
              <SettingsRow label="Email" value={activeProfile.email || "Not set"} />
              <SettingsRow label="Handle" value={handle} />
              {church ? <SettingsRow label="Church / Community" value={church} /> : null}
            </div>
            <div className={styles.settingsActions}>
              {isGuest ? (
                <>
                  <button type="button" className={styles.settingsPrimary} onClick={() => updateMode("signup")}>
                    Create profile
                  </button>
                  <button type="button" className={styles.settingsSecondary} onClick={() => updateMode("login")}>
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={styles.settingsPrimary} onClick={() => updateMode("signup")}>
                    Edit profile
                  </button>
                  <button type="button" className={styles.settingsSecondary} onClick={handleSignOut}>
                    Sign out
                  </button>
                  <button type="button" className={styles.settingsSecondary} onClick={handleDeleteAccount} style={{ color: '#e00' }}>
                    Delete account
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {authMode ? (
        <AuthOverlay
          mode={authMode}
          activeProfile={activeProfile}
          onClose={goToProfile}
          onSwitchMode={updateMode}
          onComplete={handleComplete}
        />
      ) : null}
    </div>
  )
}

function parseMode(search: string): AuthMode | null {
  const params = new URLSearchParams(search)
  const mode = params.get("mode")
  if (mode === "signup" || mode === "login") {
    return mode
  }
  return null
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.settingsRow}>
      <span className={styles.settingsLabel}>{label}</span>
      <span className={styles.settingsValue}>{value}</span>
    </div>
  )
}

type AuthOverlayProps = {
  mode: AuthMode
  activeProfile: ActiveProfile
  onClose: () => void
  onSwitchMode: (mode: AuthMode | null) => void
  onComplete: (email?: string) => void
}

export function AuthOverlay({ mode, activeProfile, onClose, onSwitchMode, onComplete }: AuthOverlayProps) {
  return (
    <div className={styles.authBackdrop}>
      <div className={styles.authPanel} role="dialog" aria-modal="true">
        <div className={styles.authHeader}>
          <h3 className={styles.authTitle}>{mode === "signup" ? "Create your Godly Me profile" : "Sign in to Godly Me"}</h3>
          <button type="button" className={styles.authClose} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        {mode === "signup" ? (
          <SignupForm activeProfile={activeProfile} onComplete={onComplete} onSwitchMode={onSwitchMode} onClose={onClose} />
        ) : (
          <SigninForm onComplete={onComplete} onSwitchMode={onSwitchMode} onClose={onClose} />
        )}
      </div>
    </div>
  )
}

type SignupFormProps = {
  activeProfile: ActiveProfile
  onComplete: (email?: string) => void
  onSwitchMode: (mode: AuthMode | null) => void
  onClose: () => void
}

function SignupForm({ activeProfile, onComplete, onSwitchMode, onClose }: SignupFormProps) {
  const initialName = normalize(activeProfile.name).includes("guest") ? "" : activeProfile.name
  const initialHandle = activeProfile.id === "guest" ? "" : activeProfile.id
  const initialChurch = activeProfile.church
  const initialCountry = activeProfile.country
  const initialPhoto = activeProfile.photo || ""
  const initialEmail =
    activeProfile.email && !normalize(activeProfile.email).includes("guest") ? activeProfile.email : ""

  const [name, setName] = useState(initialName)
  const [handle, setHandle] = useState(initialHandle)
  const [church, setChurch] = useState(initialChurch)
  const [country, setCountry] = useState(initialCountry)
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [handleDirty, setHandleDirty] = useState(Boolean(initialHandle))
  const [photo, setPhoto] = useState(initialPhoto)
  const [photoPreview, setPhotoPreview] = useState(initialPhoto)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const existingAccount = Boolean(initialEmail)

  useEffect(() => {
    if (handleDirty) return
    if (!name.trim()) {
      setHandle("")
      return
    }
    const suggestion = contentService.suggestHandle(name)
    if (suggestion && suggestion !== handle) {
      setHandle(suggestion)
    }
  }, [handle, handleDirty, name])

  function onHandleChange(next: string) {
    setHandle(next)
    setHandleDirty(Boolean(next.trim()))
  }

  function onPhotoSelected(file?: File) {
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      setPhoto(result)
      setPhotoPreview(result)
    }
    reader.readAsDataURL(file)
  }

  function openCameraPicker() {
    cameraInputRef.current?.click()
  }

  function openGalleryPicker() {
    galleryInputRef.current?.click()
  }

  function clearPhoto() {
    setPhoto("")
    setPhotoPreview("")
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (galleryInputRef.current) galleryInputRef.current.value = ""
  }

  const requiresPassword = !existingAccount

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedName = name.trim()
    const normalizedHandle = handle.trim().replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
    const trimmedEmail = email.trim().toLowerCase()
    const passwordValue = password.trim()
    const confirmValue = confirmPassword.trim()
    const countrySelection = country.trim()
    const resolvedCountry = existingAccount ? countrySelection || initialCountry.trim() : countrySelection

    if (!trimmedName) {
      setError("Enter a display name")
      return
    }
    if (!normalizedHandle) {
      setError("Choose a handle (letters, numbers, underscores)")
      return
    }
    if (!trimmedEmail) {
      setError("Enter an email")
      return
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setError("Enter a valid email")
      return
    }
    if (requiresPassword && passwordValue.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if ((requiresPassword || passwordValue || confirmValue) && passwordValue !== confirmValue) {
      setError("Passwords do not match")
      return
    }
    if (!existingAccount && !resolvedCountry) {
      setError("Select or type your country")
      return
    }

    setBusy(true)
    try {
      if (existingAccount) {
        await contentService.completeSignup({
          name: trimmedName,
          handle: normalizedHandle,
          church,
          country: resolvedCountry,
          photo: photo || null,
          email: trimmedEmail,
          password: passwordValue || undefined,
        })
      } else {
        await contentService.createAccount({
          name: trimmedName,
          handle: normalizedHandle,
          church,
          country: resolvedCountry,
          photo: photo || null,
          email: trimmedEmail,
          password: passwordValue,
        })
      }
      setError(null)
      onComplete(trimmedEmail)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save your profile right now."
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  function onCancel() {
    onClose()
    setName(initialName)
    setHandle(initialHandle)
    setChurch(initialChurch)
    setCountry(initialCountry)
    setEmail(initialEmail)
    setPassword("")
    setConfirmPassword("")
    setHandleDirty(Boolean(initialHandle))
    setPhoto(initialPhoto)
    setPhotoPreview(initialPhoto)
    setError(null)
    if (cameraInputRef.current) cameraInputRef.current.value = ""
    if (galleryInputRef.current) galleryInputRef.current.value = ""
  }

  const avatarFallback = (name || activeProfile.name || "G").slice(0, 1).toUpperCase()

  return (
    <form className={styles.authForm} onSubmit={onSubmit}>
      <p className={styles.authSubtitle}>Keep your details up to date so people know how to connect with you.</p>
      <div className={styles.authAvatarSection}>
        <div className={styles.authAvatarPreview}>
          {photoPreview ? <img src={photoPreview} alt="Profile preview" /> : <span>{avatarFallback}</span>}
        </div>
        <div className={styles.authAvatarButtons}>
          <button type="button" className={styles.authAvatarButton} onClick={openCameraPicker} disabled={busy}>
            Use camera
          </button>
          <button type="button" className={styles.authAvatarButton} onClick={openGalleryPicker} disabled={busy}>
            Choose photo
          </button>
          {photoPreview ? (
            <button type="button" className={styles.authAvatarClear} onClick={clearPhoto} disabled={busy}>
              Remove photo
            </button>
          ) : null}
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.authHiddenFile}
          onChange={(event) => onPhotoSelected(event.target.files?.[0])}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className={styles.authHiddenFile}
          onChange={(event) => onPhotoSelected(event.target.files?.[0])}
        />
      </div>
      <label className={styles.authField}>
        <span>Display name</span>
        <input
          className={styles.authInput}
          value={name}
          onChange={(event) => {
            const next = event.target.value
            setName(next)
            if (!handleDirty) {
              setHandle(contentService.suggestHandle(next))
            }
          }}
          placeholder="Hope Chapel Youth"
          disabled={busy}
        />
      </label>
      <label className={styles.authField}>
        <span>Email</span>
        <input
          className={styles.authInput}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={busy}
        />
      </label>
      <label className={styles.authField}>
        <span>Handle</span>
        <div className={styles.authHandleRow}>
          <span className={styles.authHandlePrefix}>@</span>
          <input
            value={handle}
            onChange={(event) => onHandleChange(event.target.value)}
            onBlur={() => onHandleChange(contentService.suggestHandle(handle))}
            placeholder="hopechapel"
            disabled={busy}
          />
        </div>
        <small className={styles.authHint}>Letters, numbers, underscores only.</small>
      </label>
      <label className={styles.authField}>
        <span>Password {existingAccount ? "(leave blank to keep current password)" : ""}</span>
        <input
          className={styles.authInput}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={existingAccount ? "Set a new password" : "Create a password"}
          disabled={busy}
        />
      </label>
      <label className={styles.authField}>
        <span>Confirm password</span>
        <input
          className={styles.authInput}
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirm password"
          disabled={busy}
        />
      </label>
      <label className={styles.authField}>
        <span>Church / Community (optional)</span>
        <input
          className={styles.authInput}
          value={church}
          onChange={(event) => setChurch(event.target.value)}
          placeholder="River City Church"
          disabled={busy}
        />
      </label>
      {!existingAccount ? (
        <label className={styles.authField}>
          <span>Country</span>
          <input
            className={styles.authInput}
            type="text"
            list="settings-country-options"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="Select or type your country"
            disabled={busy}
          />
          <datalist id="settings-country-options">
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      ) : null}
      {error ? <div className={styles.authError}>{error}</div> : null}
      <div className={styles.authActions}>
        <button type="submit" className={styles.authPrimary} disabled={busy}>
          {busy ? "Saving..." : existingAccount ? "Save profile" : "Create account"}
        </button>
        <button type="button" className={styles.authSecondary} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
      {existingAccount ? null : (
        <div className={styles.authFooter}>
          Already have a profile?{" "}
          <button type="button" className={styles.authLink} onClick={() => onSwitchMode("login")}>
            Sign in
          </button>
        </div>
      )}
    </form>
  )
}

type SigninFormProps = {
  onComplete: (email?: string) => void
  onSwitchMode: (mode: AuthMode | null) => void
  onClose: () => void
}

function SigninForm({ onComplete, onSwitchMode, onClose }: SigninFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [verificationCode, setVerificationCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendCountdown, setResendCountdown] = useState<number>(0)

  // Countdown timer effect
  useEffect(() => {
    if (resendCountdown <= 0) return

    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [resendCountdown])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()
    const trimmedCode = verificationCode.trim()
    if (!trimmedEmail) {
      setError("Enter your email")
      return
    }
    if (!trimmedPassword) {
      setError("Enter your password")
      return
    }
    if (needsVerification && trimmedCode.length < 4) {
      setError("Enter the 6-digit verification code.")
      return
    }
    setBusy(true)
    try {
      if (needsVerification && trimmedCode) {
        await contentService.verifyEmailCode(trimmedEmail, trimmedCode)
        setStatus("Email verified! Signing you in...")
        setNeedsVerification(false)
      } else {
        setStatus(null)
      }
      await contentService.signInWithCredentials(trimmedEmail, trimmedPassword)
      setError(null)
      window.setTimeout(() => {
        console.info(`[Simulated email] Login notification sent to ${trimmedEmail}.`)
      })
      onComplete()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in right now."
      const payload = err instanceof Error ? (err as any).payload : null
      if (payload?.needsVerification) {
        setNeedsVerification(true)
        setStatus("Please verify your email before signing in.")
      } else {
        setStatus(null)
      }
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  async function handleResendCode() {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError("Enter your email before requesting a new code.")
      return
    }
    setResendBusy(true)
    try {
      await contentService.resendVerification(trimmedEmail)
      setStatus(`We sent a new code to ${trimmedEmail}. It should arrive within 2 minutes.`)
      setError(null)
      setResendCountdown(120) // Start 2-minute countdown
    } catch (err) {
      const payload = err instanceof Error ? (err as any).payload : null

      // Handle rate limiting error
      if (payload?.secondsRemaining) {
        setResendCountdown(payload.secondsRemaining)
        setError(`Please wait ${Math.floor(payload.secondsRemaining / 60)}:${String(payload.secondsRemaining % 60).padStart(2, '0')} before requesting another code.`)
      } else {
        const message = err instanceof Error ? err.message : "Unable to resend the code right now."
        setError(message)
      }
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <form className={styles.authForm} onSubmit={submit}>
      <p className={styles.authSubtitle}>Sign in with the email and password you used when creating your profile.</p>
      <label className={styles.authField}>
        <span>Email</span>
        <input
          className={styles.authInput}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={busy || resendBusy}
        />
      </label>
      <label className={styles.authField}>
        <span>Password</span>
        <input
          className={styles.authInput}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Your password"
          disabled={busy}
        />
      </label>
      {needsVerification ? (
        <label className={styles.authField}>
          <span>Verification code</span>
          <input
            className={styles.authInput}
            type="text"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="Enter 6-digit code"
            disabled={busy}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
          />
          <small className={styles.authHint}>
            {resendCountdown > 0
              ? `Your code should arrive in ${Math.floor(resendCountdown / 60)}:${String(resendCountdown % 60).padStart(2, '0')}`
              : "Check your email for this code."
            }
          </small>
          <button
            type="button"
            className={styles.authLink}
            onClick={handleResendCode}
            disabled={busy || resendBusy || resendCountdown > 0}
          >
            {resendBusy
              ? "Sending code..."
              : resendCountdown > 0
                ? `Wait ${Math.floor(resendCountdown / 60)}:${String(resendCountdown % 60).padStart(2, '0')} to resend`
                : "Resend verification code"
            }
          </button>
        </label>
      ) : null}
      {error ? <div className={styles.authError}>{error}</div> : null}
      {status ? <div className={styles.authSuccess}>{status}</div> : null}
      <div className={styles.authActions}>
        <button type="submit" className={styles.authPrimary} disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <button type="button" className={styles.authGhost} onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
      <div className={styles.authFooter}>
        <div>
          Need a profile?{" "}
          <button type="button" className={styles.authLink} onClick={() => onSwitchMode("signup")}>
            Create one
          </button>
        </div>
        <Link to="/forgot-password" className={styles.authLink}>
          Forgot password?
        </Link>
      </div>
    </form>
  )
}
