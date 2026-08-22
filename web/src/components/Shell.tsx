import { Link, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useConfig } from '../hooks/useConfig'
import { useStations } from '../hooks/useStations'
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

function Sidebar() {
  const { username, logout } = useAuth()
  const { data: config } = useConfig()
  const { data: stations } = useStations()
  const { slug: activeSlug } = useParams<{ slug: string }>()
  const { pathname } = useLocation()

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

      <div className="nav-group-label">Operate</div>
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

      {stations && stations.length > 0 && (
        <>
          <div className="nav-group-label">Stations</div>
          {/* Scrolls on its own -- the nav above and the sign-out footer
              below stay put regardless of how many stations there are. */}
          <div className="station-nav-scroll">
            {stations.map((s) => (
              <Link
                key={s.slug}
                className={`nav-item${activeSlug === s.slug ? ' active' : ''}`}
                to={`/stations/${encodeURIComponent(s.slug)}`}
                title={s.slug}
              >
                <span className="nav-item-art">
                  <Artwork src={s.logo_url} alt="" size={18} radius={4} />
                  {s.offline ? (
                    <span className="status-dot status-dot-danger" title="Offline" />
                  ) : s.silence ? (
                    <span className="status-dot status-dot-warn" title="Silence" />
                  ) : null}
                </span>
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.name}
                </span>
                <span className="nav-count">{s.listener_count}</span>
              </Link>
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
