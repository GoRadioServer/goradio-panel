import { Link } from 'react-router-dom'
import type { StationSummary } from '../api/types'
import { Artwork } from './Artwork'
import { IconChevron, IconUsers } from './icons'

export function StationCard({ station }: { station: StationSummary }) {
  const live = station.listener_count > 0

  return (
    <Link className="station-card" to={`/stations/${encodeURIComponent(station.slug)}`}>
      <div className="station-card-top">
        <Artwork src={station.logo_url} alt="" size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="station-card-name">{station.name}</div>
          <div className="row-sub mono">{station.slug}</div>
        </div>
        <IconChevron size={15} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={`badge${live ? ' accent' : ''}`}>
          <IconUsers size={12} />
          {station.listener_count} listener{station.listener_count === 1 ? '' : 's'}
        </span>
      </div>
    </Link>
  )
}
