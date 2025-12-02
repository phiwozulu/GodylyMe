import React, { useState } from "react"
import { Link } from "react-router-dom"
import { contentService } from "../services/contentService"
import styles from "./Login.module.css"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError("Enter the email on your account.")
      return
    }
    setBusy(true)
    try {
      await contentService.requestPasswordReset(trimmedEmail)
      setStatus("If an account exists for that email, we sent instructions to reset your password.")
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send reset instructions right now."
      setError(message)
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.forgotBackdrop}>
      <div className={styles.forgotPanel}>
        <div className={styles.forgotHeader}>
          <h3>Forgot password</h3>
          <p>Enter the email you use on Godly Me and we will send you a reset link.</p>
        </div>
        <form className={styles.forgotForm} onSubmit={submit}>
          <label className={styles.forgotField}>
            <span>Email</span>
            <input
              className={styles.forgotInput}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
            />
          </label>
          {status ? <div className={styles.forgotSuccess}>{status}</div> : null}
          {error ? <div className={styles.forgotError}>{error}</div> : null}
          <div className={styles.forgotActions}>
            <button type="submit" className={styles.forgotPrimary} disabled={busy}>
              {busy ? "Sending link..." : "Send reset link"}
            </button>
            <Link className={styles.forgotSecondary} to="/profile/me/settings?mode=login">
              Back to sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
