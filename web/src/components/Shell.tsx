import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useStations } from '../hooks/useStations'
import { useCurrentServerId, useServers } from '../hooks/useServers'
import { useVersion } from '../hooks/useVersion'
import { DRAWER_QUERY, useDrawerSwipe } from '../hooks/useDrawerSwipe'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useMeasuredHeight } from '../hooks/useMeasuredHeight'
import {
  useGroupBy,
  useGroupByOptions,
  useMetadataKeys,
  useStationGroups,
} from '../hooks/useStationGroups'
import { mediaRoute, serverRoute, stationRoute } from '../api/paths'
import type { StationSummary } from '../api/types'
import { Artwork } from './Artwork'
import {
  IconChevronDown,
  IconFolder,
  IconKey,
  IconMenu,
  IconRadio,
  IconSignOut,
  IconStack,
  IconUsers,
  IconX,
} from './icons'

// One station's entry in the sidebar list, including its live status dot.
function StationNavItem({
  serverId,
  station,
  active,
}: {
  serverId: string
  station: StationSummary
  active: boolean
}) {
  return (
    <Link
      className={`nav-item${active ? ' active' : ''}`}
      to={stationRoute(serverId, station.slug)}
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

// The running version of the selected audio server, flagging when a newer
// release exists upstream. Renders nothing at all when the server doesn't
// report a version (too old for the RPC, or unreachable) -- an empty row
// would just be noise.
function ServerVersion({ serverId }: { serverId: string }) {
  const { data } = useVersion(serverId)
  if (!data?.version) return null

  if (!data.update_available || !data.latest) {
    return <div className="ns-version">{data.version}</div>
  }
  return (
    <a
      className="ns-version update"
      href={data.latest.url}
      target="_blank"
      rel="noreferrer"
      title={`${data.version} installed · ${data.latest.version} available`}
      // Stops a click bubbling into the card, which is otherwise inert but
      // sits inside the nav column.
      onClick={(e) => e.stopPropagation()}
    >
      <span className="status-dot status-dot-warn ns-version-dot" />
      {data.version} → {data.latest.version}
    </a>
  )
}

// The audio-server switcher. With one server configured it's a plain
// label; with several it becomes a select that navigates to the chosen
// server's dashboard.
function ServerSwitcher({ serverId }: { serverId: string }) {
  const { data: servers } = useServers()
  const navigate = useNavigate()

  const current = servers?.find((s) => s.id === serverId)
  const label = current?.name ?? serverId ?? '—'

  return (
    <div className="ns-card">
      <div className="ns-label">Audio server</div>
      {servers && servers.length > 1 ? (
        <div className="ns-switcher">
          <select
            className="ns-select"
            aria-label="Switch audio server"
            value={serverId}
            onChange={(e) => navigate(serverRoute(e.target.value))}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <IconChevronDown size={14} />
        </div>
      ) : (
        <div className="ns-value" title={current?.http_base_url || undefined}>
          {label}
        </div>
      )}
      <ServerVersion serverId={serverId} />
    </div>
  )
}

function Sidebar({
  onNavigate,
  innerRef,
  style,
}: {
  onNavigate?: () => void
  innerRef?: React.Ref<HTMLElement>
  style?: React.CSSProperties
}) {
  const { username, logout } = useAuth()
  const serverId = useCurrentServerId()
  const { data: stations } = useStations(serverId)
  const { slug: activeSlug } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const [groupBy, setGroupBy] = useGroupBy(serverId)

  const list = useMemo(() => stations ?? [], [stations])
  const metadataKeys = useMetadataKeys(list)
  const groupOptions = useGroupByOptions(metadataKeys, groupBy)
  const groups = useStationGroups(list, groupBy)

  const onDashboard = pathname === serverRoute(serverId)
  const onTokens = pathname === `${serverRoute(serverId)}/tokens`
  const onMedia = pathname === mediaRoute(serverId)

  return (
    // onClickCapture rather than per-link handlers: every navigation in
    // here should dismiss the mobile drawer, and catching it once at the
    // root means new links can't forget to.
    <aside
      className="sidebar"
      ref={innerRef}
      style={style}
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest('a')) onNavigate?.()
      }}
    >
      <div className="brand">
        <div className="brand-mark">
          <IconRadio size={17} />
        </div>
        <div>
          <div className="brand-name">GoRadio</div>
          <div className="brand-sub">Admin Panel</div>
        </div>
      </div>

      <ServerSwitcher serverId={serverId} />

      <div className="nav-group-label">Manage</div>
      <Link className={`nav-item${onDashboard ? ' active' : ''}`} to={serverRoute(serverId)}>
        <IconStack size={15} />
        Stations
        <span className="nav-count">{stations?.length ?? '—'}</span>
      </Link>
      <Link className={`nav-item${pathname === '/users' ? ' active' : ''}`} to="/users">
        <IconUsers size={15} />
        Users
      </Link>
      <Link className={`nav-item${onTokens ? ' active' : ''}`} to={`${serverRoute(serverId)}/tokens`}>
        <IconKey size={15} />
        Tokens
      </Link>
      <Link className={`nav-item${onMedia ? ' active' : ''}`} to={mediaRoute(serverId)}>
        <IconFolder size={15} />
        Media
      </Link>

      {list.length > 0 && (
        <>
          <div className="nav-group-head">
            <span className="nav-group-label">Stations</span>
            {groupOptions.length > 0 && (
              <select
                className="nav-group-select"
                value={groupBy}
                aria-label="Group stations by"
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="">No grouping</option>
                {groupOptions.map((k) => (
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
                      <StationNavItem
                        key={s.slug}
                        serverId={serverId}
                        station={s}
                        active={activeSlug === s.slug}
                      />
                    ))}
                  </div>
                ))
              : list.map((s) => (
                  <StationNavItem
                    key={s.slug}
                    serverId={serverId}
                    station={s}
                    active={activeSlug === s.slug}
                  />
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
  const serverId = useCurrentServerId()
  const { data: servers } = useServers()
  const { data: stations } = useStations(serverId)

  const station = stations?.find((s) => s.slug === slug)
  const onStation = Boolean(slug)
  const onEdit = pathname.endsWith('/edit')
  const serverName = servers?.find((s) => s.id === serverId)?.name ?? serverId
  const label =
    pathname === '/users'
      ? 'Users'
      : pathname.endsWith('/tokens')
        ? 'Tokens'
        : pathname.endsWith('/media')
          ? 'Media'
          : 'Stations'

  return (
    <div className="crumbs">
      <Link to={serverRoute(serverId)}>{serverName || 'goradio'}</Link>
      <span className="crumb-sep">›</span>
      {onStation ? (
        <>
          <Link to={serverRoute(serverId)}>Stations</Link>
          <span className="crumb-sep">›</span>
          {onEdit ? (
            <>
              <Link to={stationRoute(serverId, slug!)}>{station?.name ?? slug}</Link>
              <span className="crumb-sep">›</span>
              <span className="crumb-current">Edit</span>
            </>
          ) : (
            <span className="crumb-current">{station?.name ?? slug}</span>
          )}
        </>
      ) : (
        <span className="crumb-current">{label}</span>
      )}
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false)
  const { pathname } = useLocation()
  const sidebarRef = useRef<HTMLElement>(null)
  const drag = useDrawerSwipe(sidebarRef, { open: navOpen, setOpen: setNavOpen })
  // The mobile drawer is positioned below the topbar so the menu button
  // stays on top of it and can always close it again. Measured rather than
  // hard-coded because the topbar's height depends on its content.
  const [topbarRef, topbarHeight] = useMeasuredHeight<HTMLElement>(48)
  const isDrawer = useMediaQuery(DRAWER_QUERY)

  // Route changes that don't originate from a sidebar tap (breadcrumbs, a
  // station card, the browser back button) should also leave the drawer
  // closed. Adjusted during render rather than in an effect -- React
  // re-runs the render before painting, so the drawer never flashes open
  // on the new route the way an effect-based reset would.
  const [pathAtRender, setPathAtRender] = useState(pathname)
  if (pathname !== pathAtRender) {
    setPathAtRender(pathname)
    setNavOpen(false)
  }

  // Above the breakpoint there is no drawer to be open, and leaving the
  // flag set would mean coming back down to mobile lands with the drawer
  // already out.
  if (!isDrawer && navOpen) setNavOpen(false)

  // While the drawer is open it owns the screen; letting the page scroll
  // underneath it is disorienting on a phone.
  useEffect(() => {
    if (!navOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [navOpen])

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [navOpen])

  // The drawer's position has exactly ONE source: this expression. It used
  // to come from a CSS class *and* an inline transform, which meant the two
  // could disagree -- a stale inline transform would pin the drawer while
  // navOpen (and so the menu icon) carried on toggling independently.
  // Deriving both from navOpen in the same render makes that unrepresentable.
  //
  // Only on mobile: above the breakpoint the sidebar is a normal grid
  // column and must not be transformed at all.
  const sidebarStyle: React.CSSProperties | undefined = !isDrawer
    ? undefined
    : drag !== null
      ? // Following the finger: transition off, or every frame would
        // animate against the last one and lag behind.
        { transform: `translateX(${drag.offset}px)`, transition: 'none' }
      : { transform: navOpen ? 'translateX(0)' : 'translateX(-100%)' }

  // 0 = fully closed, 1 = fully open. Used to fade the backdrop in step
  // with the drag rather than popping it in at the end.
  const dragProgress = drag === null ? (navOpen ? 1 : 0) : 1 + drag.offset / drag.width

  return (
    <div
      className={`app-shell${navOpen ? ' nav-open' : ''}`}
      style={{ '--topbar-h': `${topbarHeight}px` } as React.CSSProperties}
    >
      {isDrawer && dragProgress > 0 && (
        <div
          className="nav-backdrop"
          style={drag === null ? undefined : { opacity: dragProgress, transition: 'none' }}
          onClick={() => setNavOpen(false)}
        />
      )}
      <Sidebar onNavigate={() => setNavOpen(false)} innerRef={sidebarRef} style={sidebarStyle} />
      <div className="main">
        <header className="topbar" ref={topbarRef}>
          <div className="topbar-inner">
            <button
              className="ghost sm nav-toggle"
              aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              {navOpen ? <IconX size={17} /> : <IconMenu size={17} />}
            </button>
            <Breadcrumbs />
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  )
}
