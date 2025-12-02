import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { contentService } from "../services/contentService"
import { COUNTRY_OPTIONS } from "../shared/countryOptions"
import styles from "./Signup.module.css"

export default function Signup() {
  const navigate = useNavigate()

  React.useEffect(() => {
    // Keep signup consistent with the auth modal experience.
    navigate("/profile/me/settings?mode=signup", { replace: true })
  }, [navigate])

  const [name, setName] = useState("")
  const [handle, setHandle] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [church, setChurch] = useState("")
  const [country, setCountry] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const normalizedHandle = handle.trim().replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()

  useEffect(() => {
    if (!name.trim()) return
    if (!handle.trim()) {
      setHandle(contentService.suggestHandle(name))
    }
  }, [handle, name])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const passwordValue = password.trim()
    const confirmValue = confirmPassword.trim()
    const countryValue = country.trim()

    if (!trimmedName) {
      setError("Enter a display name")
      return
    }
    if (!normalizedHandle) {
      setError("Enter a handle")
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
    if (passwordValue.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (passwordValue !== confirmValue) {
      setError("Passwords do not match")
      return
    }

    setBusy(true)
    try {
      await contentService.createAccount({
        name: trimmedName,
        handle: normalizedHandle,
        email: trimmedEmail,
        password: passwordValue,
        church,
        country: countryValue,
        photo: null,
      })
      setError(null)
      navigate("/verify-email", { state: { email: trimmedEmail } })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save your profile right now."
      setError(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.signup}>
      <h1>Create your GodlyMe profile</h1>
      <p>Choose a display name so your worship moments and testimonies are linked to you.</p>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Display name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hope Chapel Youth" disabled={busy} />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={busy} />
        </label>
        <label>
          <span>Handle</span>
          <div className={styles.handleRow}>
            <span>@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="hopechapel" disabled={busy} />
          </div>
          <small>Letters, numbers, underscores only.</small>
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            disabled={busy}
          />
        </label>
        <label>
          <span>Confirm password</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
            disabled={busy}
          />
        </label>
        <label>
          <span>Church / Community (optional)</span>
          <input value={church} onChange={(e) => setChurch(e.target.value)} placeholder="River City Church" disabled={busy} />
        </label>
        <label>
          <span>Country</span>
          <input
            type="text"
            list="country-options"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Select or type your country"
            disabled={busy}
          />
          <datalist id="country-options">
            {COUNTRY_OPTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        {error ? <div className={styles.error}>{error}</div> : null}
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? "Creating account..." : "Sign up"}
        </button>
        <button type="button" className={styles.secondary} onClick={() => navigate("/login")} disabled={busy}>
          I already have an account
        </button>
      </form>
    </div>
  )
}
