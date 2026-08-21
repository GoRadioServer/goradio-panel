import { createContext, useContext, useState, type ReactNode } from 'react'
import { apiJSON } from '../api/client'
import { clearSession, getToken, getUsername, setSession } from './authStore'

interface LoginResponse {
  token: string
  expires_at: string
  username: string
}

interface AuthContextValue {
  username: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(getUsername())

  async function login(u: string, password: string) {
    const resp = await apiJSON<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: u, password }),
    })
    setSession(resp.token, resp.username)
    setUsername(resp.username)
  }

  function logout() {
    clearSession()
    setUsername(null)
  }

  const isAuthenticated = username !== null && getToken() !== null

  return (
    <AuthContext.Provider value={{ username, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
