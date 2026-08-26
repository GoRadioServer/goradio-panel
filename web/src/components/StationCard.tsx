import { Link } from 'react-router-dom'
import type { StationSummary } from '../api/types'
import { trackTitle } from '../api/format'
import { Artwork } from './Artwork'
import { IconChevron, IconUsers } from './icons'
import { stationRoute } from '../api/paths'
import { useServerId } from '../hooks/useServers'

export function StationCard({ station }: { station: StationSummary }) {
  const live = station.listener_count > 0
  const metadata = Object.entries(station.metadata ?? {})
  const track = station.now_playing
  const serverId = useServerId()

  return (
    <Link className="station-card" to={stationRoute(serverId, station.slug)}>
      <div className="station-card-top">
        <Artwork src={station.logo_url} alt="" size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="station-card-name">{station.name}</div>
          <div className="row-sub mono">{station.slug}</div>
        </div>
        <IconChevron size={15} />
      </div>

      <div className="station-card-chips">
        <span className={`badge${live ? ' accent' : ''}`}>
          <IconUsers size={12} />
          {station.listener_count} listener{station.listener_count === 1 ? '' : 's'}
        </span>
        {metadata.map(([key, value]) => (
          <span className="chip" key={key} title={key}>
            {value}
          </span>
        ))}
        {station.managed && station.offline && (
          <span className="chip" title="Created and run by this panel -- see its Controller section">
            Managed
          </span>
        )}
      </div>

      {/* Current status, pinned to the bottom so it lines up across a row
          of cards whose metadata chips wrap to different heights. Only the
          playing state gets the accent treatment -- that's what makes a
          live station findable at a glance down a long grid. */}
      <div className={`station-card-status${track && !station.offline ? ' playing' : ''}`}>
        {station.offline ? (
          <span className="station-card-idle">
            <span className="status-dot status-dot-danger station-card-dot" />
            Offline
          </span>
        ) : track ? (
          <>
            <Artwork src={track.cover_art_url} alt="" size={28} radius={5} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="station-card-track">{trackTitle(track)}</div>
              {/* Deliberately not trackSubtitle(): its location fallback is
                  a full path, which is useful context on the station page
                  but just truncated noise in a card this size. */}
              <div className="station-card-artist">{track.display_artist || 'On air'}</div>
            </div>
            <span className="dot pulse" />
          </>
        ) : (
          <span className="station-card-idle">
            <span className="status-dot status-dot-warn station-card-dot" />
            Nothing playing
          </span>
        )}
      </div>
    </Link>
  )
}
