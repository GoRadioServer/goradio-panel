import { useEffect, useRef, useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import { IconPlay, IconStop, IconVolume, IconVolumeMuted } from './icons'
import { useServerId } from '../hooks/useServers'

type Phase = 'connecting' | 'buffered' | 'error'

interface Props {
  slug: string
  // Reports whether the station is currently audible, and -- once
  // measured -- how many seconds of buffering delay sit between the
  // audio server's reported elapsed time and what's actually coming out
  // of the speakers, so a caller (NowPlaying's progress bar) can offset
  // its own display to match reality instead of visibly running ahead.
  onAudibleChange?: (audible: boolean, latencySeconds: number | null) => void
}

// Prebuffers the station's live stream as soon as this mounts, so
// clicking "Listen" is usually near-instant instead of a fresh connection:
// setting `src` + `load()` starts the network fetch immediately regardless
// of whether playback actually starts, so by the time someone clicks,
// data is often already buffered (see `canplay` below).
//
// We also *try* a muted autoplay so the stream is already decoding by
// click time, which some browsers allow without a user gesture -- but not
// all do (Chromium's default policy can reject even muted autoplay with
// no prior interaction), so that attempt is best-effort and ignored on
// failure rather than surfaced as an error; either way the fetch/buffering
// above already happened. Note `audio.paused` becoming false only means
// playback was *requested*, not that it's actually producing sound yet --
// `everPlayedRef` (set only by the real `playing` event) is what we treat
// as proof the stream is genuinely audible already.
//
// The connection is kept alive (muted) after "Stop" too, so repeated
// listen/stop stays fast for as long as the station page stays open --
// the trade-off is the stream downloads continuously in the background
// regardless of mute state.
export function StreamPlayer({ slug, onAudibleChange }: Props) {
  const serverId = useServerId()
  const { data: config } = useConfig(serverId)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const listenClickRef = useRef<number | null>(null)
  const latencyRef = useRef<number | null>(null)
  const everPlayedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('connecting')
  const [listening, setListening] = useState(false)
  const [audibleNow, setAudibleNow] = useState(false)
  const [volume, setVolume] = useState(0.8)
  const previousVolumeRef = useRef(0.8)

  const baseURL = config?.http_base_url ?? ''
  const streamUrl = baseURL ? `${baseURL}/stream/${encodeURIComponent(slug)}` : ''

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !streamUrl) return

    setPhase('connecting')
    setListening(false)
    setAudibleNow(false)
    latencyRef.current = null
    everPlayedRef.current = false
    audio.muted = true
    audio.src = streamUrl
    audio.load()
    audio.play().catch(() => {})

    return () => stop(audio)
  }, [streamUrl])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    onAudibleChange?.(listening && audibleNow, latencyRef.current)
  }, [listening, audibleNow, onAudibleChange])

  if (!config) return null

  if (!baseURL) {
    return (
      <div className="field-hint">
        Listening isn’t configured — set <code>audioserver.http_base_url</code> in panel.yaml.
      </div>
    )
  }

  function handleCanPlay() {
    setPhase((p) => (p === 'error' ? p : 'buffered'))
  }

  function handlePlaying() {
    everPlayedRef.current = true
    setPhase('buffered')
    setAudibleNow(true)
    if (listenClickRef.current != null) {
      latencyRef.current = (performance.now() - listenClickRef.current) / 1000
      listenClickRef.current = null
    }
  }

  function handlePause() {
    setAudibleNow(false)
  }

  function toggleVolumeMute() {
    if (volume > 0) {
      previousVolumeRef.current = volume
      setVolume(0)
    } else {
      setVolume(previousVolumeRef.current || 0.8)
    }
  }

  function toggle() {
    const audio = audioRef.current
    if (!audio) return

    if (phase === 'error') {
      setPhase('connecting')
      audio.load()
      audio.play().catch(() => setPhase('error'))
      return
    }

    const next = !listening
    setListening(next)

    if (!next) {
      audio.muted = true
      return
    }

    audio.muted = false
    if (everPlayedRef.current) {
      // This connection has genuinely produced sound before (background
      // autoplay succeeded, or an earlier listen session) -- unmuting is
      // truly instant, no new "playing" event will fire to measure a
      // fresh latency from, so record it directly.
      latencyRef.current = 0
      setAudibleNow(true)
      return
    }

    // Never actually confirmed audible yet -- background autoplay was
    // either blocked or just hasn't produced a frame yet. This click is a
    // real user gesture, so play() should succeed; wait for the genuine
    // "playing" event to measure real latency.
    listenClickRef.current = performance.now()
    audio.play().catch(() => setPhase('error'))
  }

  const label =
    phase === 'error'
      ? 'Could not connect — click to retry'
      : listening
        ? audibleNow
          ? 'Live — streaming now'
          : 'Connecting…'
        : phase === 'buffered'
          ? 'Ready — click to listen instantly'
          : 'Buffering in the background…'

  return (
    <div className="player">
      <audio
        ref={audioRef}
        preload="auto"
        onCanPlay={handleCanPlay}
        onPlaying={handlePlaying}
        onPause={handlePause}
        onError={() => setPhase('error')}
      />

      <button
        className="player-btn"
        onClick={toggle}
        title={listening ? 'Stop' : 'Listen'}
        disabled={listening && !audibleNow && phase !== 'error'}
      >
        {listening && !audibleNow && phase !== 'error' ? (
          <span className="spinner" />
        ) : listening ? (
          <IconStop size={13} />
        ) : (
          <IconPlay size={14} />
        )}
      </button>

      <div className="player-status" style={phase === 'error' ? { color: 'var(--danger)' } : undefined}>
        {listening && audibleNow && (
          <span className="dot pulse" style={{ display: 'inline-block', marginRight: 7, color: 'var(--accent)' }} />
        )}
        {label}
      </div>

      <div className="player-vol">
        <button className="icon-btn" onClick={toggleVolumeMute} title={volume > 0 ? 'Mute' : 'Unmute'}>
          {volume > 0 ? <IconVolume size={19} /> : <IconVolumeMuted size={19} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          aria-label="Volume"
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, var(--accent) ${volume * 100}%, var(--surface-3) ${volume * 100}%)`,
          }}
        />
      </div>
    </div>
  )
}

function stop(audio: HTMLAudioElement | null) {
  if (!audio) return
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
}
