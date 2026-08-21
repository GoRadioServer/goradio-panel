import type { HistoryEntryStatus, TrackSourceType } from '../api/types'
import { trackTitle } from '../api/format'
import { useQueueTrack } from '../hooks/useStationMutations'
import { Artwork } from './Artwork'
import { IconRepeat } from './icons'

// The API reports the full proto enum name (e.g. "TRACK_SOURCE_TYPE_HTTP_URL");
// QueueTrackForm/useQueueTrack use the short form the backend also accepts.
function shortSourceType(type: string): TrackSourceType {
  return type.replace('TRACK_SOURCE_TYPE_', '') as TrackSourceType
}

export function HistoryList({ slug, history }: { slug: string; history: HistoryEntryStatus[] }) {
  const queueTrack = useQueueTrack(slug)

  if (history.length === 0) {
    return <div className="empty">Nothing played yet.</div>
  }

  // oldest first from the API; show most-recent first.
  const items = [...history].reverse()

  return (
    <div className="rows">
      {items.map((item) => (
        <div className="row" key={`${item.queue_id}-${item.ended_at_unix_ms}`}>
          <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Artwork src={item.source?.cover_art_url} alt="" size={30} radius={6} />
            <div style={{ minWidth: 0 }}>
              <div className="row-title">{trackTitle(item.source)}</div>
              <div className="row-sub">
                {new Date(Number(item.ended_at_unix_ms)).toLocaleTimeString()}
                {item.reason === 'interrupted' && ' · interrupted'}
              </div>
            </div>
          </div>

          <div className="row-actions">
            {item.source && (
              <button
                className="secondary sm"
                disabled={queueTrack.isPending}
                title="Queue this track again"
                onClick={() =>
                  queueTrack.mutate({
                    source: {
                      type: shortSourceType(item.source!.type),
                      location: item.source!.location,
                      display_title: item.source!.display_title || undefined,
                      display_artist: item.source!.display_artist || undefined,
                      cover_art_url: item.source!.cover_art_url || undefined,
                    },
                    mode: 'APPEND',
                  })
                }
              >
                <IconRepeat size={13} />
                Requeue
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
