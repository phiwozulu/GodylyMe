import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { contentService, type ContentCategory } from '../services/contentService'
import styles from './Upload.module.css'

const categories: { value: ContentCategory; label: string }[] = [
  { value: 'testimony', label: 'Testimony' },
  { value: 'devotional', label: 'Devotional' },
  { value: 'worship', label: 'Worship Moment' },
  { value: 'teaching', label: 'Teaching' },
  { value: 'prayer', label: 'Prayer' },
]

export default function Upload() {
  const [isAuthenticated, setIsAuthenticated] = useState(contentService.isAuthenticated())
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState<ContentCategory>('testimony')
  const [tags, setTags] = useState('hope, encouragement')
  const [error, setError] = useState<string | null>(null)
  const [cameraSupported, setCameraSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isRequestingCamera, setIsRequestingCamera] = useState(false)
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const livePreviewRef = useRef<HTMLVideoElement | null>(null)
  const recordedPreviewRef = useRef<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const nav = useNavigate()

  useEffect(() => {
    const supported =
      typeof navigator !== 'undefined' && !!navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function'
    setCameraSupported(supported)
    return () => {
      cleanupStream()
      if (recordedPreviewRef.current) {
        URL.revokeObjectURL(recordedPreviewRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const unsubscribe = contentService.subscribe(() => {
      setIsAuthenticated(contentService.isAuthenticated())
    })
    return unsubscribe
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      alert('Pick a video to share with the GodlyMe community.')
      return
    }

    try {
      await contentService.createUpload({
        title: title || 'Untitled Testimony',
        description,
        file,
        category,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      setError(null)
      nav('/')
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to upload right now. Please double-check your details and try again.'
      setError(message)
      if (message.toLowerCase().includes('sign in')) {
        window.setTimeout(() => {
          nav('/profile/me/settings?mode=signup')
        }, 400)
      }
    }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null
    resetRecordedPreview()
    setFile(selectedFile)
  }

  function cleanupStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (livePreviewRef.current) {
      livePreviewRef.current.srcObject = null
    }
  }

  function resetRecordedPreview() {
    if (recordedPreviewRef.current) {
      URL.revokeObjectURL(recordedPreviewRef.current)
      recordedPreviewRef.current = null
    }
    setRecordedPreviewUrl(null)
  }

  async function startRecording() {
    if (!cameraSupported || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera recording is not supported in this browser.')
      return
    }
    if (isRecording) return
    setCameraError(null)
    setIsRequestingCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: true,
      })
      streamRef.current = stream
      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream
        await livePreviewRef.current.play().catch(() => undefined)
      }
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []
        const recordedFile = new File([blob], `vessel-recording-${Date.now()}.webm`, { type: mimeType })
        resetRecordedPreview()
        const url = URL.createObjectURL(blob)
        recordedPreviewRef.current = url
        setRecordedPreviewUrl(url)
        setFile(recordedFile)
        cleanupStream()
        mediaRecorderRef.current = null
      }
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to access the camera. Please grant permissions and try again.'
      setCameraError(message)
      cleanupStream()
    } finally {
      setIsRequestingCamera(false)
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    setIsRecording(false)
  }

  function discardRecording() {
    setCameraError(null)
    chunksRef.current = []
    cleanupStream()
    setIsRecording(false)
    resetRecordedPreview()
    mediaRecorderRef.current = null
    setFile(null)
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.upload}>
        <h1>Share a Godly Me Moment</h1>
        <p className={styles.subtitle}>
          Sign in to share testimonies, worship moments, and encouragement with the community.
        </p>
        <div className={styles.authGate}>
          <p>You need to be signed in before you can upload videos or record new moments.</p>
          <div className={styles.authGateActions}>
            <button type="button" onClick={() => nav('/profile/me/settings?mode=login')}>
              Sign in
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => nav('/profile/me/settings?mode=signup')}>
              Create profile
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.upload}>
      <h1>Share a Godly Me Moment</h1>
      <p className={styles.subtitle}>
        Encourage the community with what God is doing. Short testimonies, scripture reflections, and worship sessions
        are all welcome.
      </p>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Romans 8 encouragement" />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Share the story or context behind this moment."
            rows={4}
          />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ContentCategory)}>
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tags (comma separated)</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className={styles.fileInput}>
          <span>Upload video</span>
          <input type="file" accept="video/*" onChange={handleFileChange} />
        </label>
        {file ? <p className={styles.fileMeta}>Ready to upload: {file.name}</p> : null}

        <section className={styles.recorder}>
          <div className={styles.recorderHeader}>
            <span>Record using your camera</span>
            <p>
              Capture a fresh testimony on the spot. Your recording stays on this device until you submit the upload.
            </p>
          </div>
          <div className={styles.cameraPreview}>
            <video ref={livePreviewRef} muted playsInline autoPlay />
            {!streamRef.current && !isRecording ? <span className={styles.cameraPlaceholder}>Camera preview</span> : null}
          </div>
          <div className={styles.recordControls}>
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!cameraSupported || isRequestingCamera}
            >
              {isRecording ? 'Stop recording' : 'Record with camera'}
            </button>
            {recordedPreviewUrl ? (
              <button type="button" className={styles.secondaryButton} onClick={discardRecording}>
                Remove recording
              </button>
            ) : null}
            {!cameraSupported ? (
              <span className={styles.recorderHint}>Recording requires a device with camera support.</span>
            ) : null}
          </div>
          {cameraError ? <p className={styles.recorderError}>{cameraError}</p> : null}
          {recordedPreviewUrl ? (
            <div className={styles.previewBlock}>
              <span>Recorded preview</span>
              <video src={recordedPreviewUrl} controls playsInline className={styles.previewVideo} />
            </div>
          ) : null}
        </section>

        <div className={styles.actions}>
          <button type="submit">Upload to GodlyMe</button>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>
    </div>
  )
}
