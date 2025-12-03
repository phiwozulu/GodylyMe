import React, { useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { contentService } from "../services/contentService"
import styles from "./Signup.module.css"

type LocationState = {
  email?: string
}

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const state = (location.state as LocationState) || {}
  const initialEmail = state.email || searchParams.get("email") || contentService.getActiveProfile().email || ""

  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedCode = code.trim()
    if (!trimmedEmail) {
      setError("Enter your email.")
      return
    }
    if (trimmedCode.length < 4) {
      setError("Enter the 6-digit verification code.")
      return
    }
    setBusy(true)
    try {
      await contentService.verifyEmailCode(trimmedEmail, trimmedCode)
      setStatus("Email verified! Your account is now active.")
      setError(null)
      // Redirect to profile page instead of login since they're already authenticated
      window.setTimeout(() => navigate("/profile/me"), 1400)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to verify that code right now."
      setError(message)
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  async function onResend() {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError("Enter your email before requesting a new code.")
      return
    }
    setResendBusy(true)
    try {
      await contentService.resendVerification(trimmedEmail)
      setStatus(`We sent a new code to ${trimmedEmail}.`)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to resend the code right now."
      setError(message)
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <div className={styles.signup}>
      <h1>Verify your email</h1>
      <p>Enter the 6-digit code we emailed you to activate your account.</p>
      <div className={styles.verificationBox}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy || resendBusy}
          />
        </label>
        <form className={styles.codeForm} onSubmit={submit}>
          <input
            className={styles.codeInput}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            disabled={busy}
          />
          <button type="submit" disabled={busy || code.length < 6}>
            {busy ? "Verifying..." : "Verify email"}
          </button>
        </form>
        <div className={styles.supportActions}>
          <button type="button" className={styles.linkButton} onClick={onResend} disabled={resendBusy}>
            {resendBusy ? "Sending..." : "Resend code"}
          </button>
          <button type="button" className={styles.secondary} onClick={() => navigate("/signup")}>
            Back to sign up
          </button>
        </div>
        <button type="button" className={styles.linkButton} onClick={() => navigate("/login")}>
          Already verified? Sign in
        </button>
        {status ? <div className={styles.success}>{status}</div> : null}
        {error ? <div className={styles.error}>{error}</div> : null}
      </div>
    </div>
  )
}
