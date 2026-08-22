import type { HistoryEntryStatus, QueueMode, TrackSourceType } from '../api/types'
import { trackTitle } from '../api/format'
import { useQueueTrack } from '../hooks/useStationMutations'
import { Artwork } from './Artwork'
import { SplitButton } from './SplitButton'
import { IconRepeat } from './icons'

// The API reports the full proto enum name (e.g. "TRACK_SOURCE_TYPE_HTTP_URL");
// QueueTrackForm/useQueueTrack use the short form the backend also accepts.
function shortSourceType(type: string): TrackSourceType {
  return type.replace('TRACK_SOURCE_TYPE_', '') as TrackSourceType
}

// Every requeue mode, offered behind the button's caret. Append is listed
// explicitly even though it's what the main click already does, so the menu
// shows the full set of choices rather than only the exceptions.
const MODES: { mode: QueueMode; label: string; hint: string }[] = [
  { mode: 'APPEND', label: 'Add to end', hint: 'Back of the queue' },
  { mode: 'PLAY_NEXT', label: 'Play next', hint: 'Front of the queue' },
  { mode: 'PLAY_NOW_INTERRUPT', label: 'Play now', hint: 'Interrupts current track' },
]

export function HistoryList({ slug, history }: { slug: string; history: HistoryEntryStatus[] }) {
  const queueTrack = useQueueTrack(slug)

  const requeue = (item: HistoryEntryStatus, mode: QueueMode) => {
    if (!item.source) return
    queueTrack.mutate({
      source: {
        type: shortSourceType(item.source.type),
        location: item.source.location,
        display_title: item.source.display_title || undefined,
        display_artist: item.source.display_artist || undefined,
        cover_art_url: item.source.cover_art_url || undefined,
      },
      mode,
    })
  }

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
              <SplitButton
                disabled={queueTrack.isPending}
                title="Queue this track again"
                menuLabel="Requeue with a specific mode"
                onClick={() => requeue(item, 'APPEND')}
                options={MODES.map(({ mode, label, hint }) => ({
                  label,
                  hint,
                  onSelect: () => requeue(item, mode),
                }))}
              >
                <IconRepeat size={13} />
                Requeue
              </SplitButton>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
