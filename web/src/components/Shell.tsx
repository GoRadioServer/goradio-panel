import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useConfig } from '../hooks/useConfig'
import { useStations } from '../hooks/useStations'
import { useMetadataKeys, useStationGroups } from '../hooks/useStationGroups'
import type { StationSummary } from '../api/types'
import { Artwork } from './Artwork'
import { IconKey, IconRadio, IconSignOut, IconStack, IconUsers } from './icons'

function serverLabel(httpBaseURL: string | undefined): string {
  if (!httpBaseURL) return 'audio server'
  try {
    return new URL(httpBaseURL).host
  } catch {
    return httpBaseURL
  }
}

// One station's entry in the sidebar list, including its live status dot.
function StationNavItem({ station, active }: { station: StationSummary; active: boolean }) {
  return (
    <Link
      className={`nav-item${active ? ' active' : ''}`}
      to={`/stations/${encodeURIComponent(station.slug)}`}
      title={station.slug}
    >
      <span className="nav-item-art">
        <Artwork src={station.logo_url} alt="" size={18} radius={4} />
        {station.offline ? (
          <span className="status-dot status-dot-danger" title="Offline" />
        ) : station.silence ? (
          <span className="status-dot status-dot-warn" title="Silence" />
        ) : null}
      </span>
      <span className="nav-item-name">{station.name}</span>
      <span className="nav-count">{station.listener_count}</span>
    </Link>
  )
}

function Sidebar() {
  const { username, logout } = useAuth()
  const { data: config } = useConfig()
  const { data: stations } = useStations()
  const { slug: activeSlug } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const [groupBy, setGroupBy] = useState('')

  const list = useMemo(() => stations ?? [], [stations])
  const metadataKeys = useMetadataKeys(list)
  const groups = useStationGroups(list, groupBy)

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <IconRadio size={17} />
        </div>
        <div>
          <div className="brand-name">GoRadio</div>
          <div className="brand-sub">Admin Panel</div>
        </div>
      </div>

      <div className="ns-card">
        <div className="ns-label">Audio server</div>
        <div className="ns-value" title={config?.http_base_url || undefined}>
          {serverLabel(config?.http_base_url)}
        </div>
      </div>

      <div className="nav-group-label">Manage</div>
      <Link className={`nav-item${pathname === '/' ? ' active' : ''}`} to="/">
        <IconStack size={15} />
        Stations
        <span className="nav-count">{stations?.length ?? '—'}</span>
      </Link>
      <Link className={`nav-item${pathname === '/users' ? ' active' : ''}`} to="/users">
        <IconUsers size={15} />
        Users
      </Link>
      <Link className={`nav-item${pathname === '/tokens' ? ' active' : ''}`} to="/tokens">
        <IconKey size={15} />
        Tokens
      </Link>

      {list.length > 0 && (
        <>
          <div className="nav-group-head">
            <span className="nav-group-label">Stations</span>
            {metadataKeys.length > 0 && (
              <select
                className="nav-group-select"
                value={groupBy}
                aria-label="Group stations by"
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="">No grouping</option>
                {metadataKeys.map((k) => (
                  <option key={k} value={k}>
                    by {k}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* Scrolls on its own -- the nav above and the sign-out footer
              below stay put regardless of how many stations there are. */}
          <div className="station-nav-scroll">
            {groups
              ? groups.map(([value, stationsInGroup]) => (
                  <div className="nav-subgroup" key={value}>
                    <div className="nav-subgroup-label">
                      {value}
                      <span className="nav-count">{stationsInGroup.length}</span>
                    </div>
                    {stationsInGroup.map((s) => (
                      <StationNavItem key={s.slug} station={s} active={activeSlug === s.slug} />
                    ))}
                  </div>
                ))
              : list.map((s) => (
                  <StationNavItem key={s.slug} station={s} active={activeSlug === s.slug} />
                ))}
          </div>
        </>
      )}

      <div className="sidebar-foot">
        <div className="avatar">{(username || '?').slice(0, 1)}</div>
        <div className="sidebar-user">{username}</div>
        <button className="ghost sm" onClick={logout} title="Sign out" style={{ marginLeft: 'auto' }}>
          <IconSignOut size={15} />
        </button>
      </div>
    </aside>
  )
}

function Breadcrumbs() {
  const { pathname } = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const { data: stations } = useStations()

  const station = stations?.find((s) => s.slug === slug)
  const onStation = pathname.startsWith('/stations/')
  const label = pathname === '/users' ? 'Users' : pathname === '/tokens' ? 'Tokens' : 'Stations'

  return (
    <div className="crumbs">
      <Link to="/">goradio</Link>
      <span className="crumb-sep">›</span>
      {onStation ? (
        <>
          <Link to="/">Stations</Link>
          <span className="crumb-sep">›</span>
          <span className="crumb-current">{station?.name ?? slug}</span>
        </>
      ) : (
        <span className="crumb-current">{label}</span>
      )}
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main">
        <header className="topbar">
          <div className="topbar-inner">
            <Breadcrumbs />
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
