import { useState, type FormEvent } from 'react'
import type { QueueMode, TrackSourceType } from '../api/types'
import { useQueueTrack } from '../hooks/useStationMutations'
import { IconPlus } from './icons'
import { useServerId } from '../hooks/useServers'

export function QueueTrackForm({ slug, onQueued }: { slug: string; onQueued?: () => void }) {
  const [advanced, setAdvanced] = useState(false)
  const [sourceType, setSourceType] = useState<TrackSourceType>('HTTP_URL')
  const [location, setLocation] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [coverArtUrl, setCoverArtUrl] = useState('')
  const [mode, setMode] = useState<QueueMode>('APPEND')

  const serverId = useServerId()
  const queueTrack = useQueueTrack(serverId, slug)
  const isLocal = advanced && sourceType === 'LOCAL_FILE'

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    queueTrack.mutate(
      {
        source: {
          type: sourceType,
          location,
          display_title: title || undefined,
          display_artist: artist || undefined,
          cover_art_url: coverArtUrl || undefined,
        },
        mode,
      },
      {
        onSuccess: () => {
          setLocation('')
          setTitle('')
          setArtist('')
          setCoverArtUrl('')
          onQueued?.()
        },
      },
    )
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="form-row">
        <div className="field" style={{ flex: '3 1 240px' }}>
          <label htmlFor="location">{isLocal ? 'File path (relative to audio_root)' : 'Audio URL'}</label>
          <input
            id="location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={isLocal ? 'idents/station-id.mp3' : 'https://example.com/track.mp3'}
          />
        </div>
        <div className="field" style={{ flex: '0 1 160px' }}>
          <label htmlFor="mode">Mode</label>
          <select id="mode" value={mode} onChange={(e) => setMode(e.target.value as QueueMode)}>
            <option value="APPEND">Append</option>
            <option value="PLAY_NEXT">Play next</option>
            <option value="PLAY_NOW_INTERRUPT">Play now</option>
          </select>
        </div>
      </div>

      <div className="form-row" style={{ marginTop: 11 }}>
        <div className="field">
          <label htmlFor="title">Title (optional)</label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="artist">Artist (optional)</label>
          <input id="artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="cover-art">Cover art URL (optional)</label>
          <input
            id="cover-art"
            value={coverArtUrl}
            onChange={(e) => setCoverArtUrl(e.target.value)}
            placeholder="https://example.com/art.jpg"
          />
        </div>
        <button type="submit" disabled={queueTrack.isPending}>
          {queueTrack.isPending ? <span className="spinner" /> : <IconPlus size={14} />}
          Queue
        </button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="ghost sm"
          onClick={() => {
            setAdvanced((v) => !v)
            setSourceType(advanced ? 'HTTP_URL' : 'LOCAL_FILE')
          }}
        >
          {advanced ? '← Use a URL instead' : 'Advanced: queue a local file path'}
        </button>
        {isLocal && (
          <span className="field-hint">
            The panel can’t browse the audio server’s filesystem — enter a path you know exists.
          </span>
        )}
      </div>

      {queueTrack.isError && (
        <p className="error-text" style={{ marginBottom: 0 }}>
          {(queueTrack.error as Error).message}
        </p>
      )}
    </form>
  )
}
