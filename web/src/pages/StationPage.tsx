import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStationStatus } from '../hooks/useStationStatus'
import { useStationEvents } from '../hooks/useStationEvents'
import { useListenerStats } from '../hooks/useListenerStats'
import { useStationProcess } from '../hooks/useManagedStation'
import { useClearQueue, useSkip, useUnregisterStation } from '../hooks/useStationMutations'
import { formatUptime } from '../api/format'
import { NowPlaying } from '../components/NowPlaying'
import { QueueList } from '../components/QueueList'
import { QueueTrackForm } from '../components/QueueTrackForm'
import { HistoryList } from '../components/HistoryList'
import { ListenerChart } from '../components/ListenerChart'
import { Artwork } from '../components/Artwork'
import { Modal } from '../components/Modal'
import { useMeasuredHeight } from '../hooks/useMeasuredHeight'
import { IconPencil, IconPlus, IconPower, IconSkip, IconTrash } from '../components/icons'
import { stationEditRoute } from '../api/paths'
import { useServerId } from '../hooks/useServers'

export function StationPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const serverId = useServerId()
  const { data: status, isLoading, isError } = useStationStatus(serverId, slug)
  const { data: stats } = useListenerStats(serverId, slug)
  const { data: process } = useStationProcess(serverId, slug)
  const navigate = useNavigate()
  useStationEvents(serverId, slug)

  const skip = useSkip(serverId, slug)
  const clearQueue = useClearQueue(serverId, slug)
  const unregister = useUnregisterStation(serverId, slug)
  const [stopCurrentOnClear, setStopCurrentOnClear] = useState(false)
  const [queueModalOpen, setQueueModalOpen] = useState(false)
  // The logo should match the title block's real rendered height (it
  // varies with viewport width -- badges/chips wrap onto more lines on
  // narrower screens), not a fixed guess.
  const [titlesRef, titlesHeight] = useMeasuredHeight<HTMLDivElement>(42)

  if (isLoading) {
    return (
      <div className="center-note">
        <span className="spinner" /> Loading station…
      </div>
    )
  }
  // GetStatus never 404s -- an unknown/never-registered slug still comes
  // back 200 with is_registered: false (see the "Unregistered" badge
  // below), so this only fires on a genuine failure (network, auth).
  if (isError || !status) return <p className="error-text">Failed to load station.</p>

  const listeners = Number(status.listener_count)

  return (
    <>
      <div className="page-head">
        <Artwork src={status.logo_url} alt="" size={titlesHeight} radius={11} />
        <div className="page-titles" ref={titlesRef}>
          <div className="page-title-row">
            <h1 className="page-title">{status.name}</h1>
            {status.is_silence ? (
              <span className="badge">
                <span className="dot" /> Silence
              </span>
            ) : (
              <span className="badge accent">
                <span className="dot pulse" /> On air
              </span>
            )}
            {!status.is_registered && <span className="badge danger">Unregistered</span>}
          </div>
          <div className="page-meta">
            <span className="chip">{status.slug}</span>
            {Object.entries(status.metadata ?? {}).map(([key, value]) => (
              <span className="chip" key={key}>
                {key}: {value}
              </span>
            ))}
          </div>
        </div>

        <div className="page-actions">
          <button onClick={() => setQueueModalOpen(true)}>
            <IconPlus size={14} />
            Queue track
          </button>
          <button className="secondary" disabled={skip.isPending} onClick={() => skip.mutate()}>
            <IconSkip size={14} />
            Skip track
          </button>
          {process && (
            <button className="secondary" onClick={() => navigate(stationEditRoute(serverId, slug))}>
              <IconPencil size={14} />
              Edit
            </button>
          )}
          <button
            className="danger"
            disabled={unregister.isPending}
            onClick={() => {
              if (confirm(`Unregister station "${status.slug}"? A live controller may re-register it.`)) {
                unregister.mutate()
              }
            }}
          >
            <IconPower size={14} />
            Unregister
          </button>
        </div>
      </div>

      {queueModalOpen && (
        <Modal title="Queue a track" onClose={() => setQueueModalOpen(false)}>
          <QueueTrackForm slug={slug} onQueued={() => setQueueModalOpen(false)} />
        </Modal>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">Listeners</div>
          <div className="stat-value">{listeners}</div>
          <div className="stat-sub">tuned in right now</div>
        </div>
        <div className="stat">
          <div className="stat-label">Queued</div>
          <div className="stat-value">{status.queue.length}</div>
          <div className="stat-sub">items pending</div>
        </div>
        <div className="stat">
          <div className="stat-label">Uptime</div>
          <div className="stat-value">{formatUptime(Number(status.uptime_seconds))}</div>
          <div className="stat-sub">since registration</div>
        </div>
      </div>

      <div className="stack">
        <NowPlaying status={status} />

        <div className="card">
          <div className="card-head">
            <span className="card-title">Listener history</span>
            <span className="field-hint">last 24h</span>
          </div>
          <div className="card-body">
            <ListenerChart points={stats ?? []} />
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-head">
              <span className="card-title">
                Queue{status.queue.length > 0 && ` · ${status.queue.length}`}
              </span>
              <div className="card-head-actions">
                <label className="checkline">
                  <input
                    type="checkbox"
                    checked={stopCurrentOnClear}
                    onChange={(e) => setStopCurrentOnClear(e.target.checked)}
                  />
                  also stop current
                </label>
                <button
                  className="secondary sm"
                  disabled={clearQueue.isPending}
                  onClick={() => clearQueue.mutate(stopCurrentOnClear)}
                >
                  <IconTrash size={13} />
                  Clear
                </button>
              </div>
            </div>
            <div className="card-body flush scroll-list">
              <QueueList slug={slug} queue={status.queue} />
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <span className="card-title">Recently played</span>
            </div>
            <div className="card-body flush scroll-list">
              <HistoryList slug={slug} history={status.history} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
