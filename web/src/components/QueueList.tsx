import type { QueuedItemStatus } from '../api/types'
import { formatDuration, shortEnum, trackTitle } from '../api/format'
import { useRemoveFromQueue, useSkipTo } from '../hooks/useStationMutations'
import { Artwork } from './Artwork'
import { IconSkip, IconTrash } from './icons'

export function QueueList({ slug, queue }: { slug: string; queue: QueuedItemStatus[] }) {
  const removeFromQueue = useRemoveFromQueue(slug)
  const skipTo = useSkipTo(slug)

  if (queue.length === 0) {
    return <div className="empty">Queue is empty.</div>
  }

  return (
    <div className="rows">
      {queue.map((item, i) => {
        const duration = Number(item.duration_seconds)
        return (
          <div className="row" key={item.queue_id}>
            <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Artwork src={item.source?.cover_art_url} alt="" size={30} radius={6} />
              <div style={{ minWidth: 0 }}>
                <div className="row-main">
                  <span className="row-index">{i + 1}</span>
                  <span className="row-title">{trackTitle(item.source)}</span>
                </div>
                <div className="row-sub" style={{ paddingLeft: 27 }}>
                  {item.source?.display_artist || item.source?.location}
                </div>
              </div>
            </div>

            <div className="row-actions">
              <span className="chip">{duration > 0 ? formatDuration(duration) : 'live'}</span>
              {item.mode !== 'QUEUE_MODE_APPEND' && (
                <span className="badge warn">{shortEnum(item.mode)}</span>
              )}
              <button
                className="secondary sm"
                disabled={skipTo.isPending}
                title="Skip straight to this item"
                onClick={() => skipTo.mutate(item.queue_id)}
              >
                <IconSkip size={13} />
                Skip to
              </button>
              <button
                className="danger sm"
                disabled={removeFromQueue.isPending}
                title="Remove from queue"
                onClick={() => removeFromQueue.mutate(item.queue_id)}
              >
                <IconTrash size={13} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
