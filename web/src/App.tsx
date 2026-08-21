import { type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Shell } from './components/Shell'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { StationPage } from './pages/StationPage'
import { UsersPage } from './pages/UsersPage'

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
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
              <Route
                path="/"
                element={
                  <Shell>
                    <DashboardPage />
                  </Shell>
                }
              />
              <Route
                path="/stations/:slug"
                element={
                  <Shell>
                    <StationPage />
                  </Shell>
                }
              />
              <Route
                path="/users"
                element={
                  <Shell>
                    <UsersPage />
                  </Shell>
                }
              />
            </Routes>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
