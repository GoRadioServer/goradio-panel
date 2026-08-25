import { useState } from 'react'
import { useStations } from '../hooks/useStations'
import { useQueueTrack } from '../hooks/useStationMutations'
import { useServerId } from '../hooks/useServers'
import { DirectoryBrowser } from '../components/DirectoryBrowser'
import { IconFolder, IconPlus } from '../components/icons'
import type { DirectoryEntry, QueueMode } from '../api/types'

export function MediaPage() {
  const serverId = useServerId()
  const { data: stations } = useStations(serverId)
  const [slug, setSlug] = useState('')
  const [mode, setMode] = useState<QueueMode>('APPEND')
  const [lastQueued, setLastQueued] = useState('')

  const queueTrack = useQueueTrack(serverId, slug)

  function onSelectFile(entry: DirectoryEntry) {
    if (!slug) return
    queueTrack.mutate(
      { source: { type: 'LOCAL_FILE', location: entry.path }, mode },
      { onSuccess: () => setLastQueued(entry.path) },
    )
  }

  const station = stations?.find((s) => s.slug === slug)

  return (
    <>
      <div className="page-head">
        <div className="page-icon">
          <IconFolder size={20} />
        </div>
        <div className="page-titles">
          <div className="page-title-row">
            <h1 className="page-title">Media Browser</h1>
          </div>
          <div className="page-meta">Browse the audio server's audio_root and queue a file straight to a station.</div>
        </div>
      </div>

      <div className="stack">
        <div className="card">
          <div className="card-body">
            <div className="form-row">
              <div className="field" style={{ flex: '2 1 220px' }}>
                <label htmlFor="media-station">Queue to station</label>
                <select id="media-station" value={slug} onChange={(e) => setSlug(e.target.value)}>
                  <option value="">Select a station…</option>
                  {(stations ?? []).map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ flex: '0 1 160px' }}>
                <label htmlFor="media-mode">Mode</label>
                <select id="media-mode" value={mode} onChange={(e) => setMode(e.target.value as QueueMode)}>
                  <option value="APPEND">Append</option>
                  <option value="PLAY_NEXT">Play next</option>
                  <option value="PLAY_NOW_INTERRUPT">Play now</option>
                </select>
              </div>
            </div>

            {!slug && (
              <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Pick a station above, then click a file below to queue it.
              </p>
            )}
            {slug && queueTrack.isPending && (
              <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                <span className="spinner" /> Queueing…
              </p>
            )}
            {slug && queueTrack.isSuccess && lastQueued && !queueTrack.isPending && (
              <p className="field-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                <IconPlus size={12} /> Queued <code>{lastQueued}</code> to {station?.name ?? slug}.
              </p>
            )}
            {queueTrack.isError && (
              <p className="error-text" style={{ marginTop: 10, marginBottom: 0 }}>
                {(queueTrack.error as Error).message}
              </p>
            )}
          </div>
        </div>

        <DirectoryBrowser serverId={serverId} mode="queue" onSelectFile={onSelectFile} disableFileSelect={!slug} />
      </div>
    </>
  )
}
