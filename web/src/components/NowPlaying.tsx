import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { StationStatus } from '../api/types'
import { formatDuration, trackTitle } from '../api/format'
import { useTickingElapsed } from '../hooks/useTickingElapsed'
import { useSeek } from '../hooks/useStationMutations'
import { Artwork } from './Artwork'
import { StreamPlayer } from './StreamPlayer'
import { useServerId } from '../hooks/useServers'

export function NowPlaying({ status }: { status: StationStatus }) {
  const current = status.current_track
  const serverElapsed = Number(status.current_track_elapsed_seconds)
  const duration = current ? Number(current.duration_seconds) : 0
  const elapsed = useTickingElapsed(
    serverElapsed,
    duration,
    !status.is_silence && current != null,
    current?.queue_id ?? null,
  )

  // The player buffers a few seconds before what it fetches becomes
  // audible, so "elapsed" (the audio server's own truth) visibly runs
  // ahead of what's actually coming out of the speakers. Once the player
  // has measured that buffering delay, show the offset time instead --
  // matching the progress bar to what you can actually hear.
  const [audible, setAudible] = useState(false)
  const [latency, setLatency] = useState<number | null>(null)
  const onAudibleChange = useCallback((isAudible: boolean, latencySeconds: number | null) => {
    setAudible(isAudible)
    setLatency(latencySeconds)
  }, [])

  const synced = audible && latency != null
  const displayElapsed = synced ? Math.max(0, elapsed - latency) : elapsed

  // Not applicable to silence/nothing-playing or a live relay (no fixed
  // duration to seek within), matching the audio server's own Seek rules.
  const seekable = current != null && duration > 0
  const serverId = useServerId()
  const seek = useSeek(serverId, status.slug)
  const [dragPercent, setDragPercent] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const clearDragTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      if (clearDragTimer.current) clearTimeout(clearDragTimer.current)
    }
  }, [])

  function percentFromEvent(e: ReactPointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect()
    return Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!seekable) return
    if (clearDragTimer.current) clearTimeout(clearDragTimer.current)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setDragPercent(percentFromEvent(e))
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    setDragPercent(percentFromEvent(e))
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)

    const finalPercent = percentFromEvent(e)
    seek.mutate((finalPercent / 100) * duration)

    // Keep showing the target position (instead of snapping back to the
    // pre-seek elapsed) until the invalidated station query has had a
    // chance to refetch and useTickingElapsed resyncs to the real value.
    clearDragTimer.current = setTimeout(() => setDragPercent(null), 600)
  }

  const pct = dragPercent ?? (duration > 0 ? Math.min(100, (displayElapsed / duration) * 100) : 0)
  const timeLabel = dragging || dragPercent != null ? (dragPercent! / 100) * duration : displayElapsed
  const source = current?.source

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Now playing</span>
        <div className="card-head-actions">
          {status.is_silence ? (
            <span className="badge">
              <span className="dot" /> Silence
            </span>
          ) : (
            <span className="badge accent">
              <span className="dot pulse" /> On air
            </span>
          )}
        </div>
      </div>

      <div className="card-body">
        {current ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Artwork src={source?.cover_art_url} alt="" size={52} radius={8} />
              <div style={{ minWidth: 0 }}>
                <div className="np-title">{trackTitle(source)}</div>
                <div className="np-artist">
                  {source?.display_artist || <span className="mono">{source?.location}</span>}
                </div>
              </div>
            </div>

            <div
              className={`progress-hit${seekable ? ' seekable' : ''}${dragging ? ' dragging' : ''}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <div className={`progress-bar${duration > 0 ? '' : ' indeterminate'}`}>
                <div style={{ width: duration > 0 ? `${pct}%` : '100%' }} />
              </div>
              {seekable && <div className="progress-thumb" style={{ left: `${pct}%` }} />}
            </div>
            <div className="progress-times">
              <span>
                {formatDuration(timeLabel)}
                {synced && !dragging && dragPercent == null && (
                  <span className="field-hint" title="Synced to what's actually audible, offset for buffering delay">
                    {' '}
                    · synced
                  </span>
                )}
              </span>
              <span>{duration > 0 ? formatDuration(duration) : 'live'}</span>
            </div>
          </>
        ) : (
          <div className="np-title" style={{ color: 'var(--text-dim)' }}>
            Nothing playing
          </div>
        )}

        <div style={{ marginTop: 15 }}>
          <StreamPlayer slug={status.slug} onAudibleChange={onAudibleChange} />
        </div>
      </div>
    </div>
  )
}
