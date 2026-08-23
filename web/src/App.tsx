import { type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { useServers } from './hooks/useServers'
import { serverRoute, stationRoute } from './api/paths'
import { Shell } from './components/Shell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { StationPage } from './pages/StationPage'
import { UsersPage } from './pages/UsersPage'
import { TokensPage } from './pages/TokensPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Resolves a route that didn't name a server to the default one. Used for
// "/" and for the pre-multi-server "/stations/:slug" links, which are
// still worth honouring since they may be bookmarked.
function RedirectToDefaultServer({ station }: { station?: boolean }) {
  const { slug } = useParams<{ slug: string }>()
  const { data: servers, isLoading, isError } = useServers()

  if (isLoading) {
    return (
      <div className="center-note">
        <span className="spinner" /> Loading…
      </div>
    )
  }
  if (isError || !servers || servers.length === 0) {
    return <p className="error-text">No audio servers are configured.</p>
  }

  const target = servers.find((s) => s.default) ?? servers[0]
  const to = station && slug ? stationRoute(target.id, slug) : serverRoute(target.id)
  return <Navigate to={to} replace />
}

function shell(page: ReactNode) {
  return <Shell>{page}</Shell>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Routes>
              <Route path="/" element={<RedirectToDefaultServer />} />
              <Route path="/stations/:slug" element={<RedirectToDefaultServer station />} />

              <Route path="/servers/:server" element={shell(<DashboardPage />)} />
              <Route path="/servers/:server/stations/:slug" element={shell(<StationPage />)} />
              <Route path="/servers/:server/tokens" element={shell(<TokensPage />)} />

              <Route path="/users" element={shell(<UsersPage />)} />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
