import { useMemo, useState } from 'react'
import { useStations } from '../hooks/useStations'
import {
  useGroupBy,
  useGroupByOptions,
  useMetadataKeys,
  useStationGroups,
} from '../hooks/useStationGroups'
import { StationCard } from '../components/StationCard'
import { CreateStationModal } from '../components/CreateStationModal'
import { IconPlus, IconStack } from '../components/icons'
import { useServerId } from '../hooks/useServers'

export function DashboardPage() {
  const serverId = useServerId()
  const { data: stations, isLoading, isError } = useStations(serverId)
  const [groupBy, setGroupBy] = useGroupBy(serverId)
  const [creating, setCreating] = useState(false)

  const list = useMemo(() => stations ?? [], [stations])
  const metadataKeys = useMetadataKeys(list)
  const groupOptions = useGroupByOptions(metadataKeys, groupBy)
  const groups = useStationGroups(list, groupBy)

  if (isLoading) {
    return (
      <div className="center-note">
        <span className="spinner" /> Loading stations…
      </div>
    )
  }
  if (isError) return <p className="error-text">Failed to load stations.</p>

  const totalListeners = list.reduce((n, s) => n + s.listener_count, 0)
  const withListeners = list.filter((s) => s.listener_count > 0).length

  return (
    <>
      <div className="page-head">
        <div className="page-icon">
          <IconStack size={20} />
        </div>
        <div className="page-titles">
          <div className="page-title-row">
            <h1 className="page-title">Stations</h1>
          </div>
          <div className="page-meta">
            Every station currently registered on the audio server
          </div>
        </div>
        <div className="page-actions">
          {groupOptions.length > 0 && (
            <div className="field">
              <label htmlFor="group-by">Group by</label>
              <select
                id="group-by"
                style={{ width: 'auto' }}
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="">None</option>
                {groupOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="button" onClick={() => setCreating(true)}>
            <IconPlus size={14} />
            Create Station
          </button>
        </div>
      </div>

      {creating && <CreateStationModal serverId={serverId} onClose={() => setCreating(false)} />}

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">Registered</div>
          <div className="stat-value">{list.length}</div>
          <div className="stat-sub">stations live</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total listeners</div>
          <div className="stat-value">{totalListeners}</div>
          <div className="stat-sub">across all stations</div>
        </div>
        <div className="stat">
          <div className="stat-label">With listeners</div>
          <div className="stat-value">{withListeners}</div>
          <div className="stat-sub">stations being tuned in</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="empty">
            No stations are currently registered.
            <br />
            Start a controller (<code>radio station</code>) to register one,
            or create one manually above.
          </div>
        </div>
      ) : groups ? (
        groups.map(([value, stationsInGroup]) => (
          <div className="station-group" key={value}>
            <div className="group-heading">
              <span className="card-title">{value}</span>
              <span className="badge">{stationsInGroup.length}</span>
            </div>
            <div className="station-grid">
              {stationsInGroup.map((s) => (
                <StationCard key={s.slug} station={s} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="station-grid">
          {list.map((s) => (
            <StationCard key={s.slug} station={s} />
          ))}
        </div>
      )}
    </>
  )
}
