import { useMemo, useState } from 'react'
import { useStations } from '../hooks/useStations'
import { StationCard } from '../components/StationCard'
import { IconStack } from '../components/icons'
import type { StationSummary } from '../api/types'

const UNGROUPED_LABEL = 'Ungrouped'

export function DashboardPage() {
  const { data: stations, isLoading, isError } = useStations()
  const [groupBy, setGroupBy] = useState('')

  const list = useMemo(() => stations ?? [], [stations])

  // Every key seen across any station's metadata -- e.g. "type", "game" --
  // not a fixed list, since the audio server treats metadata as freeform
  // and any operator can set whatever keys they want.
  const metadataKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const s of list) {
      for (const k of Object.keys(s.metadata ?? {})) keys.add(k)
    }
    return Array.from(keys).sort()
  }, [list])

  // Stations missing the selected key (or with it set to "") fall into an
  // "Ungrouped" bucket rather than being dropped from the list.
  const groups = useMemo(() => {
    if (!groupBy) return null
    const byValue = new Map<string, StationSummary[]>()
    for (const s of list) {
      const value = s.metadata?.[groupBy] || UNGROUPED_LABEL
      if (!byValue.has(value)) byValue.set(value, [])
      byValue.get(value)!.push(s)
    }
    return Array.from(byValue.entries()).sort(([a], [b]) => {
      if (a === UNGROUPED_LABEL) return 1
      if (b === UNGROUPED_LABEL) return -1
      return a.localeCompare(b)
    })
  }, [list, groupBy])

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
        {metadataKeys.length > 0 && (
          <div className="page-actions">
            <div className="field">
              <label htmlFor="group-by">Group by</label>
              <select
                id="group-by"
                style={{ width: 'auto' }}
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="">None</option>
                {metadataKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-label">Registered</div>
          <div className="stat-value">{list.length}</div>
          <div className="stat-sub">stations live</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total listeners</div>
          <div className={`stat-value${totalListeners > 0 ? ' accent' : ''}`}>{totalListeners}</div>
          <div className="stat-sub">across all stations</div>
        </div>
        <div className="stat">
          <div className="stat-label">With listeners</div>
          <div className={`stat-value${withListeners > 0 ? ' success' : ''}`}>{withListeners}</div>
          <div className="stat-sub">stations being tuned in</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="empty">
            No stations are currently registered.
            <br />
            Start a controller (<code>radio station</code>) to register one.
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
