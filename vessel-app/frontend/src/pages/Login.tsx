import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { contentService } from "../services/contentService"
import styles from "./Login.module.css"

export default function Login() {
  const nav = useNavigate()

  React.useEffect(() => {
    // Keep auth flows consistent: send users to the profile auth modal.
    nav("/profile/me/settings?mode=login", { replace: true })
  }, [nav])

  // Fallback UI (rarely shown) in case navigation is blocked.
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()
    if (!trimmedEmail) {
      setError("Enter your email")
      return
    }
    if (!trimmedPassword) {
      setError("Enter your password")
      return
    }
    setBusy(true)
    try {
      await contentService.signInWithCredentials(trimmedEmail, trimmedPassword)
      setError(null)
      window.setTimeout(() => {
        console.info(`[Simulated email] Login notification sent to ${trimmedEmail}.`)
      })
      nav("/")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to sign in right now."
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  function loginAsGuest() {
    contentService.signIn("Guest Creator")
    setError(null)
    setEmail("")
    setPassword("")
    nav("/")
  }

  return (
    <div className={styles.login}>
      <h1>Sign in to Vessel</h1>
      <p className={styles.subtitle}>Enter the email and password you used when creating your account.</p>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={busy}
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            disabled={busy}
          />
        </label>
        {error ? <div className={styles.error}>{error}</div> : null}
        <div className={styles.actions}>
          <button type="submit" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <button type="button" onClick={loginAsGuest} disabled={busy}>
            Continue as guest
          </button>
        </div>
      </form>
      <div className={styles.supportLinks}>
        <Link to="/forgot-password">Forgot password?</Link>
        <Link to="/profile/me/settings?mode=signup">Need an account?</Link>
      </div>
    </div>
  )
}
